package shared

import (
	"context"
	"errors"
	"sync/atomic"
)

type pooledScraper struct {
	scraper ConsultaScraper
	sem     chan struct{}
}

type ScraperPool struct {
	items []*pooledScraper
	rr    uint32
}

func newConsultaScraper(_ context.Context, _ bool, _ bool, _ bool) (ConsultaScraper, error) {
	return NewPublicAPIScraper(), nil
}

func NewScraperPool(parent context.Context, size int, _ bool, _ bool, _ bool) (*ScraperPool, error) {
	if size < 1 {
		size = 1
	}
	pool := &ScraperPool{items: make([]*pooledScraper, 0, size)}
	for i := 0; i < size; i++ {
		scraper, err := newConsultaScraper(parent, false, false, false)
		if err != nil {
			pool.Close()
			return nil, err
		}
		pool.items = append(pool.items, &pooledScraper{
			scraper: scraper,
			sem:     make(chan struct{}, 2),
		})
	}
	return pool, nil
}

func (p *ScraperPool) Close() {
	if p == nil {
		return
	}
	for _, item := range p.items {
		if item != nil && item.scraper != nil {
			item.scraper.Close()
		}
	}
	p.items = nil
}

func (p *ScraperPool) borrow() *pooledScraper {
	if p == nil || len(p.items) == 0 {
		return nil
	}
	n := atomic.AddUint32(&p.rr, 1)
	return p.items[int(n-1)%len(p.items)]
}

var errScraperUnavailable = errors.New("scraper no disponible")
