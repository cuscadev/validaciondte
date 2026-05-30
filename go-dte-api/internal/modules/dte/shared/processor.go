package shared

import (
	"context"
	"sync"
	"time"
)

func ProcessLinks(parent context.Context, links []string, concurrency int) []Result {
	if concurrency < 1 {
		concurrency = 1
	}
	if concurrency > len(links) && len(links) > 0 {
		concurrency = len(links)
	}

	results := make([]Result, len(links))
	jobs := make(chan int)
	var wg sync.WaitGroup

	scraper, err := NewScraper(parent)
	if err != nil {
		for idx, link := range links {
			results[idx] = baseErrorResult(link, err)
		}
		return results
	}
	defer scraper.Close()

	for worker := 0; worker < concurrency; worker++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range jobs {
				ctx, cancel := context.WithTimeout(parent, 18*time.Second)
				result := scraper.ConsultarDTE(ctx, links[idx])
				cancel()

				if result.Estado == "ERROR" || result.Estado == "DESCONOCIDO" {
					ctxRetry, cancelRetry := context.WithTimeout(parent, 18*time.Second)
					result = scraper.ConsultarDTE(ctxRetry, links[idx])
					cancelRetry()
				}

				results[idx] = result
				time.Sleep(60 * time.Millisecond)
			}
		}()
	}

	for i := range links {
		jobs <- i
	}
	close(jobs)
	wg.Wait()

	return results
}
