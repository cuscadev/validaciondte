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

func newConsultaScraper(parent context.Context, useRod bool, httpFastPath bool) (ConsultaScraper, error) {
	var scraper ConsultaScraper
	var err error
	if useRod {
		scraper, err = NewRodScraper(parent)
	} else {
		scraper, err = NewScraper(parent)
	}
	if err != nil {
		return nil, err
	}
	return wrapHTTPFastPath(scraper, httpFastPath), nil
}

func NewScraperPool(parent context.Context, size int, useRod bool, httpFastPath bool) (*ScraperPool, error) {
	if size < 1 {
		size = 1
	}
	pool := &ScraperPool{items: make([]*pooledScraper, 0, size)}
	for i := 0; i < size; i++ {
		scraper, err := newConsultaScraper(parent, useRod, httpFastPath)
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
