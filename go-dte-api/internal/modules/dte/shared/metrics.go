package shared

import (
	"log"
	"sync/atomic"
	"time"
)

type scrapeMetrics struct {
	totalRequests atomic.Uint64
	cacheHits     atomic.Uint64
	cacheMisses   atomic.Uint64
	adminWins     atomic.Uint64
	webappWins    atomic.Uint64
	totalLatency  atomic.Uint64
}

var metrics scrapeMetrics

func RecordCacheHit() {
	metrics.cacheHits.Add(1)
}

func RecordCacheMiss() {
	metrics.cacheMisses.Add(1)
}

func RecordScrape(source string, latency time.Duration, cacheHit bool) {
	metrics.totalRequests.Add(1)
	if cacheHit {
		metrics.cacheHits.Add(1)
	} else {
		metrics.cacheMisses.Add(1)
	}
	metrics.totalLatency.Add(uint64(latency.Milliseconds()))
	switch source {
	case "admin":
		metrics.adminWins.Add(1)
	case "webapp":
		metrics.webappWins.Add(1)
	}
	log.Printf(
		"scrape source=%s latency_ms=%d cache=%t total=%d",
		source,
		latency.Milliseconds(),
		cacheHit,
		metrics.totalRequests.Load(),
	)
}

func MetricsSnapshot() map[string]uint64 {
	total := metrics.totalRequests.Load()
	avgLatency := uint64(0)
	if total > 0 {
		avgLatency = metrics.totalLatency.Load() / total
	}
	return map[string]uint64{
		"total_requests":  total,
		"cache_hits":      metrics.cacheHits.Load(),
		"cache_misses":    metrics.cacheMisses.Load(),
		"admin_wins":      metrics.adminWins.Load(),
		"webapp_wins":     metrics.webappWins.Load(),
		"avg_latency_ms":  avgLatency,
	}
}
