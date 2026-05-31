package shared

import (
	"context"
	"sync"
	"time"

	"verificador-dte/go-dte-api/internal/common/config"
)

const scrapeTimeout = 18 * time.Second

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
	return nil
}

func CloseScrapeRuntime() {
	runtimeInitMu.Lock()
	defer runtimeInitMu.Unlock()
	if defaultRuntime != nil {
		defaultRuntime.Close()
		defaultRuntime = nil
	}
}

func runtimeOrNil() *ScrapeRuntime {
	runtimeInitMu.Lock()
	defer runtimeInitMu.Unlock()
	return defaultRuntime
}

func NewScrapeRuntime(parent context.Context, cfg config.Config) (*ScrapeRuntime, error) {
	pool, err := NewScraperPool(parent, cfg.BrowserPoolSize, cfg.UseRodScraper, cfg.HTTPFastPath)
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

func ProcessBatch(parent context.Context, links []string, concurrency int) []Result {
	cfg := config.Load()
	if runtimeOrNil() == nil {
		_ = InitScrapeRuntime(context.Background(), cfg)
	}
	if runtime := runtimeOrNil(); runtime != nil {
		return runtime.ProcessBatch(parent, links, concurrency)
	}
	runtime, err := NewScrapeRuntime(parent, cfg)
	if err != nil {
		results := make([]Result, len(links))
		for i, link := range links {
			results[i] = baseErrorResult(link, err)
		}
		return results
	}
	defer runtime.Close()
	return runtime.ProcessBatch(parent, links, concurrency)
}

type pendingWork struct {
	url       string
	callbacks []func(Result)
}

func (r *ScrapeRuntime) ProcessBatch(parent context.Context, links []string, concurrency int) []Result {
	if len(links) == 0 {
		return nil
	}
	if concurrency < 1 {
		concurrency = r.cfg.Concurrency
	}
	if concurrency > len(links) {
		concurrency = len(links)
	}

	results := make([]Result, len(links))
	plan := dedupeLinks(links)

	jobs := make(chan *pendingWork, len(plan.unique)+16)
	var wg sync.WaitGroup
	pending := map[string]*pendingWork{}
	var pendingMu sync.Mutex
	limiter := newRateLimiter(r.cfg.MinIntervalMs)

	submit := func(url string, onComplete func(Result)) {
		key := cacheKeyFromURL(url)
		if r.cache != nil {
			if hit, ok := r.cache.Get(url); ok {
				onComplete(hit)
				return
			}
		}

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
					results[origIdx] = res
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
	item.sem <- struct{}{}
	defer func() { <-item.sem }()

	if r.cache != nil {
		return r.cache.Consult(item.scraper, parent, url, scrapeTimeout)
	}
	return consultWithRetry(item.scraper, parent, url, scrapeTimeout)
}
