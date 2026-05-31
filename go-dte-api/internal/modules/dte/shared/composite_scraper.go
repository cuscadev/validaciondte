package shared

import (
	"context"
	"strings"
	"sync"
	"time"
)

type CompositeScraper struct {
	scrapers []namedScraper
}

type namedScraper struct {
	name    string
	scraper ConsultaScraper
}

func NewCompositeScraper() *CompositeScraper {
	return &CompositeScraper{
		scrapers: []namedScraper{
			{name: "admin", scraper: NewAdminPublicAPIScraper()},
			{name: "webapp", scraper: NewWebappPublicAPIScraper()},
		},
	}
}

func (c *CompositeScraper) Close() {}

func (c *CompositeScraper) ConsultarDTE(parent context.Context, rawURL string) Result {
	ctx, cancel := context.WithTimeout(parent, 6*time.Second)
	defer cancel()

	start := time.Now()
	type raceResult struct {
		name   string
		result Result
	}

	ch := make(chan raceResult, len(c.scrapers))
	var wg sync.WaitGroup
	for _, item := range c.scrapers {
		wg.Add(1)
		go func(ns namedScraper) {
			defer wg.Done()
			ch <- raceResult{name: ns.name, result: ns.scraper.ConsultarDTE(ctx, rawURL)}
		}(item)
	}
	go func() {
		wg.Wait()
		close(ch)
	}()

	var fallback Result
	for rr := range ch {
		if isSuccessfulConsulta(rr.result) {
			RecordScrape(rr.name, time.Since(start), false)
			return rr.result
		}
		if fallback.Estado == "" || (fallback.Error == "" && rr.result.Error != "") {
			fallback = rr.result
		}
	}
	if fallback.Estado != "" || fallback.Error != "" {
		RecordScrape("composite", time.Since(start), false)
		return fallback
	}
	RecordScrape("composite", time.Since(start), false)
	return baseErrorResult(rawURL, errScraperUnavailable)
}

func isSuccessfulConsulta(result Result) bool {
	if result.OK {
		return true
	}
	switch result.Estado {
	case "EMITIDO", "INVALIDADO", "RECHAZADO", "ANULADO", "NO ENCONTRADO":
		return strings.TrimSpace(result.Error) == ""
	}
	return false
}
