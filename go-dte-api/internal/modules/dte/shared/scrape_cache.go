package shared

import (
	"context"
	"strings"
	"sync"
	"time"
)

type scrapeCacheEntry struct {
	result    Result
	expiresAt time.Time
}

type ScrapeCache struct {
	ttl   time.Duration
	mu    sync.RWMutex
	items map[string]scrapeCacheEntry
}

func NewScrapeCache(ttlSeconds int) *ScrapeCache {
	if ttlSeconds <= 0 {
		return nil
	}
	return &ScrapeCache{
		ttl:   time.Duration(ttlSeconds) * time.Second,
		items: map[string]scrapeCacheEntry{},
	}
}

func cacheKeyFromURL(rawURL string) string {
	return strings.ToUpper(SanitizarURL(rawURL))
}

func (c *ScrapeCache) Get(rawURL string) (Result, bool) {
	if c == nil {
		return Result{}, false
	}
	key := cacheKeyFromURL(rawURL)
	c.mu.RLock()
	entry, ok := c.items[key]
	c.mu.RUnlock()
	if !ok || time.Now().After(entry.expiresAt) {
		return Result{}, false
	}
	return entry.result, true
}

func (c *ScrapeCache) Set(rawURL string, result Result) {
	if c == nil {
		return
	}
	key := cacheKeyFromURL(rawURL)
	c.mu.Lock()
	c.items[key] = scrapeCacheEntry{
		result:    result,
		expiresAt: time.Now().Add(c.ttl),
	}
	c.mu.Unlock()
}

func (c *ScrapeCache) Consult(scraper ConsultaScraper, parent context.Context, rawURL string, timeout time.Duration) Result {
	if hit, ok := c.Get(rawURL); ok {
		return hit
	}
	result := consultWithRetry(scraper, parent, rawURL, timeout)
	if result.Estado != "ERROR" && strings.TrimSpace(result.Error) == "" {
		c.Set(rawURL, result)
	}
	return result
}
