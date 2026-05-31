package shared

import (
	"context"
	"io"
	"net/http"
	"strings"
	"time"
)

// TryConsultarDTEHTTP intenta obtener el HTML de consultaPublica sin browser.
// El portal de Hacienda requiere JS para ejecutar la búsqueda; este fast path
// solo sirve si la respuesta inicial ya contiene el detalle del DTE.
func TryConsultarDTEHTTP(parent context.Context, rawURL string) (Result, bool) {
	sanitized := SanitizarURL(rawURL)
	req, err := http.NewRequestWithContext(parent, http.MethodGet, sanitized, nil)
	if err != nil {
		return Result{}, false
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 VerificadorDTE-Go/1.0")
	req.Header.Set("Accept-Language", "es-SV,es;q=0.9")

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return Result{}, false
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil || resp.StatusCode >= 400 {
		return Result{}, false
	}

	html := string(body)
	text := strings.ToLower(stripTags(html))
	if !strings.Contains(text, "estado del dte") && !strings.Contains(text, "transmitido satisfactoriamente") {
		return Result{}, false
	}
	if strings.Contains(text, "realizar búsqueda") || strings.Contains(text, "realizar busqueda") {
		return Result{}, false
	}

	base := baseErrorResult(rawURL, nil)
	base.Estado = "DESCONOCIDO"
	result := MapHTMLResult(html, base)
	if result.Estado == "ERROR" || result.Estado == "DESCONOCIDO" {
		return Result{}, false
	}
	return result, true
}

type httpFirstScraper struct {
	inner ConsultaScraper
}

func (h *httpFirstScraper) ConsultarDTE(parent context.Context, rawURL string) Result {
	if result, ok := TryConsultarDTEHTTP(parent, rawURL); ok {
		return result
	}
	if h.inner == nil {
		return baseErrorResult(rawURL, errScraperUnavailable)
	}
	return h.inner.ConsultarDTE(parent, rawURL)
}

func (h *httpFirstScraper) Close() {
	if h.inner != nil {
		h.inner.Close()
	}
}

func wrapHTTPFastPath(scraper ConsultaScraper, enabled bool) ConsultaScraper {
	if !enabled || scraper == nil {
		return scraper
	}
	return &httpFirstScraper{inner: scraper}
}
