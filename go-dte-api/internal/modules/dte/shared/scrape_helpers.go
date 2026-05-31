package shared

import (
	"context"
	"errors"
	"net"
	"strings"
	"sync"
	"syscall"
	"time"
)

// shouldRetryScrape kept for tests documenting old behavior expectations.
func shouldRetryScrape(result Result, scrapeErr error) bool {
	return isRetryableScrapeError(result, scrapeErr)
}

func isRetryableScrapeError(result Result, scrapeErr error) bool {
	if scrapeErr != nil {
		return isTransientNetworkError(scrapeErr)
	}
	if msg := strings.TrimSpace(result.Error); msg != "" {
		return isTransientNetworkError(errors.New(msg))
	}
	return false
}

func isTransientNetworkError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "connection reset") ||
		strings.Contains(msg, "connection refused") ||
		strings.Contains(msg, "broken pipe") ||
		strings.Contains(msg, "i/o timeout") ||
		strings.Contains(msg, "no such host") ||
		strings.Contains(msg, "tls handshake timeout") ||
		errors.Is(err, syscall.ECONNRESET) ||
		errors.Is(err, syscall.ECONNREFUSED)
}

func consultWithRetry(scraper ConsultaScraper, parent context.Context, url string, timeout time.Duration) Result {
	ctx, cancel := context.WithTimeout(parent, timeout)
	result := scraper.ConsultarDTE(ctx, url)
	cancel()

	if !isRetryableScrapeError(result, nil) {
		return result
	}

	ctxRetry, cancelRetry := context.WithTimeout(parent, timeout)
	defer cancelRetry()
	return scraper.ConsultarDTE(ctxRetry, url)
}

type dedupePlan struct {
	unique       []string
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
