package shared

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"
)

func shouldRetryScrape(result Result, scrapeErr error) bool {
	if scrapeErr != nil {
		return true
	}
	if strings.TrimSpace(result.Error) != "" {
		return true
	}
	if result.Estado == "ERROR" {
		return true
	}
	return false
}

func consultWithRetry(scraper ConsultaScraper, parent context.Context, url string, timeout time.Duration) Result {
	ctx, cancel := context.WithTimeout(parent, timeout)
	result := scraper.ConsultarDTE(ctx, url)
	cancel()

	if !shouldRetryScrape(result, nil) {
		return result
	}

	ctxRetry, cancelRetry := context.WithTimeout(parent, timeout)
	defer cancelRetry()
	retry := scraper.ConsultarDTE(ctxRetry, url)
	if shouldRetryScrape(retry, nil) {
		return retry
	}
	return retry
}

type dedupePlan struct {
	unique   []string
	origToUnique []int
}

func dedupeLinks(links []string) dedupePlan {
	seen := map[string]int{}
	unique := []string{}
	origToUnique := make([]int, len(links))

	for i, link := range links {
		key := SanitizarURL(link)
		if idx, ok := seen[key]; ok {
			origToUnique[i] = idx
			continue
		}
		seen[key] = len(unique)
		origToUnique[i] = len(unique)
		unique = append(unique, link)
	}

	return dedupePlan{unique: unique, origToUnique: origToUnique}
}

type rateLimiter struct {
	minInterval time.Duration
	mu          sync.Mutex
	last        time.Time
}

func newRateLimiter(minIntervalMs int) *rateLimiter {
	if minIntervalMs <= 0 {
		return nil
	}
	return &rateLimiter{minInterval: time.Duration(minIntervalMs) * time.Millisecond}
}

func (r *rateLimiter) wait() {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.last.IsZero() {
		r.last = time.Now()
		return
	}
	elapsed := time.Since(r.last)
	if elapsed < r.minInterval {
		time.Sleep(r.minInterval - elapsed)
	}
	r.last = time.Now()
}

var errScrapeNotReady = errors.New("pagina no lista para scrape")
