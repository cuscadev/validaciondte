package shared

import (
	"context"
	"sync"
	"time"

	"verificador-dte/go-dte-api/internal/common/config"
)

const scrapeTimeout = 10 * time.Second

type ScrapeRuntime struct {
	pool  *ScraperPool
	cache *ScrapeCache
	cfg   config.Config
}

var (
	defaultRuntime *ScrapeRuntime
	runtimeInitMu  sync.Mutex
)

func InitScrapeRuntime(parent context.Context, cfg config.Config) error {
	runtimeInitMu.Lock()
	defer runtimeInitMu.Unlock()

	if defaultRuntime != nil {
		defaultRuntime.Close()
	}

	runtime, err := NewScrapeRuntime(parent, cfg)
	if err != nil {
		return err
	}
	defaultRuntime = runtime
	InitRedisStore(cfg)
	return nil
}

func CloseScrapeRuntime() {
	runtimeInitMu.Lock()
	defer runtimeInitMu.Unlock()
	if defaultRuntime != nil {
		defaultRuntime.Close()
		defaultRuntime = nil
	}
	CloseRedisStore()
}

func runtimeOrNil() *ScrapeRuntime {
	runtimeInitMu.Lock()
	defer runtimeInitMu.Unlock()
	return defaultRuntime
}

func NewScrapeRuntime(parent context.Context, cfg config.Config) (*ScrapeRuntime, error) {
	pool, err := NewScraperPool(parent, cfg.BrowserPoolSize, cfg.UseRodScraper, cfg.UseBrowser, cfg.HTTPFastPath)
	if err != nil {
		return nil, err
	}
	return &ScrapeRuntime{
		pool:  pool,
		cache: NewScrapeCache(cfg.ScrapeCacheTTLSeconds),
		cfg:   cfg,
	}, nil
}

func (r *ScrapeRuntime) Close() {
	if r == nil {
		return
	}
	if r.pool != nil {
		r.pool.Close()
	}
}

func ProcessLinkEntriesWithOptions(parent context.Context, entries []LinkEntry, opts BatchOptions) []Result {
	cfg := config.Load()
	if runtimeOrNil() == nil {
		_ = InitScrapeRuntime(context.Background(), cfg)
	}
	if runtime := runtimeOrNil(); runtime != nil {
		return runtime.processLinkEntries(parent, entries, opts)
	}
	runtime, err := NewScrapeRuntime(parent, cfg)
	if err != nil {
		results := make([]Result, len(entries))
		for i, entry := range entries {
			results[i] = baseErrorResult(entry.URL, err)
			results[i].NombreArchivo = entry.NombreArchivo
		}
		return results
	}
	defer runtime.Close()
	return runtime.processLinkEntries(parent, entries, opts)
}

type pendingWork struct {
	url       string
	callbacks []func(Result)
}

func (r *ScrapeRuntime) processLinkEntries(parent context.Context, entries []LinkEntry, opts BatchOptions) []Result {
	if len(entries) == 0 {
		return nil
	}

	links := make([]string, len(entries))
	fileNames := make([]string, len(entries))
	for i, entry := range entries {
		links[i] = entry.URL
		fileNames[i] = entry.NombreArchivo
	}

	concurrency := opts.Concurrency
	if concurrency < 1 {
		concurrency = r.cfg.Concurrency
	}
	if concurrency > len(links) {
		concurrency = len(links)
	}

	results := make([]Result, len(links))
	plan := dedupeLinks(links)
	completed := 0
	var progressMu sync.Mutex

	jobs := make(chan *pendingWork, len(plan.unique)+16)
	var wg sync.WaitGroup
	pending := map[string]*pendingWork{}
	var pendingMu sync.Mutex
	limiter := newRateLimiter(r.cfg.EffectiveMinIntervalMs())

	reportProgress := func() {
		if opts.OnProgress == nil {
			return
		}
		progressMu.Lock()
		done := completed
		progressMu.Unlock()
		opts.OnProgress(done, len(results), append([]Result(nil), results...))
	}

	submit := func(url string, onComplete func(Result)) {
		key := cacheKeyFromURL(url)
		if hit, ok := LookupConsultCache(url); ok {
			RecordCacheHit()
			onComplete(hit)
			return
		}
		if r.cache != nil {
			if hit, ok := r.cache.Get(url); ok {
				RecordCacheHit()
				onComplete(hit)
				return
			}
		}
		RecordCacheMiss()

		pendingMu.Lock()
		item, exists := pending[key]
		if !exists {
			item = &pendingWork{url: url}
			pending[key] = item
			wg.Add(1)
			jobs <- item
		}
		item.callbacks = append(item.callbacks, onComplete)
		pendingMu.Unlock()
	}

	enqueueNC := func(parentIdx int, res Result) {
		if !opts.EnrichCreditNotes {
			return
		}
		nc := PickNotaCredito(res.Relacionados)
		if nc == nil {
			return
		}
		ambiente := res.Ambiente
		if ambiente == "" {
			ambiente = "01"
		}
		fechaEmi := FechaEmiFromGeneracion(nc.FechaGeneracion)
		if fechaEmi == "" {
			applyNotaCreditoFields(&results[parentIdx], nc, Result{}, errMissingNCDate)
			syncRelatedNC(&results[parentIdx], *nc, Result{}, errMissingNCDate)
			return
		}
		ncCopy := *nc
		pIdx := parentIdx
		submit(
			BuildConsultaURL(nc.CodigoGeneracion, fechaEmi, ambiente),
			func(verified Result) {
				applyNotaCreditoFields(&results[pIdx], &ncCopy, verified, nil)
				syncRelatedNC(&results[pIdx], ncCopy, verified, nil)
			},
		)
	}

	for uniqueIdx, url := range plan.unique {
		uIdx := uniqueIdx
		submit(url, func(res Result) {
			for origIdx, mapped := range plan.origToUnique {
				if mapped == uIdx {
					res.NombreArchivo = fileNames[origIdx]
					results[origIdx] = res
					progressMu.Lock()
					completed++
					progressMu.Unlock()
					reportProgress()
					enqueueNC(origIdx, res)
				}
			}
		})
	}

	for worker := 0; worker < concurrency; worker++ {
		go func() {
			for item := range jobs {
				limiter.wait()
				result := r.scrapeOne(parent, item.url)
				StoreConsultCache(item.url, result)
				for _, cb := range item.callbacks {
					cb(result)
				}
				wg.Done()
			}
		}()
	}

	wg.Wait()
	close(jobs)

	return results
}

func (r *ScrapeRuntime) scrapeOne(parent context.Context, url string) Result {
	item := r.pool.borrow()
	if item == nil || item.scraper == nil {
		return baseErrorResult(url, errScraperUnavailable)
	}

	if r.cache != nil {
		return r.cache.Consult(item.scraper, parent, url, scrapeTimeout)
	}
	return consultWithRetry(item.scraper, parent, url, scrapeTimeout)
}

func FileParseErrorResult(filename, message string) Result {
	return Result{
		NombreArchivo: filename,
		Visitar:       "Abrir",
		Estado:        "ERROR",
		TipoDteNorm:   "SIN_TIPO",
		Relacionados:  []RelatedDocument{},
		Error:         message,
	}
}
