package certificates

import (
	"sync"
	"time"

	signerdomain "verificador-dte/go-dte-api/internal/modules/facturacion/signer/domain"
)

type cachedCertificate struct {
	cert      *signerdomain.CertificateMH
	expiresAt time.Time
}

type Cache struct {
	mu    sync.RWMutex
	items map[string]cachedCertificate
	ttl   time.Duration
}

func NewCache(ttl time.Duration) *Cache {
	if ttl <= 0 {
		ttl = time.Hour
	}
	return &Cache{
		items: make(map[string]cachedCertificate),
		ttl:   ttl,
	}
}

func (c *Cache) Get(nit string) *signerdomain.CertificateMH {
	c.mu.RLock()
	defer c.mu.RUnlock()
	item, ok := c.items[nit]
	if !ok || time.Now().After(item.expiresAt) {
		return nil
	}
	return item.cert
}

func (c *Cache) Set(nit string, cert *signerdomain.CertificateMH) {
	if cert == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[nit] = cachedCertificate{
		cert:      cert,
		expiresAt: time.Now().Add(c.ttl),
	}
}

func (c *Cache) Delete(nit string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, nit)
}
