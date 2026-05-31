package shared

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"
)

func TestLiveProcessLinksEnrichNC(t *testing.T) {
	if os.Getenv("LIVE_SCRAPE") != "1" {
		t.Skip("set LIVE_SCRAPE=1 to run")
	}

	url := "https://admin.factura.gob.sv/consultaPublica?ambiente=01&codGen=94C33B18-35A3-4589-8C62-D9B68FDD6408&fechaEmi=2026-05-23"
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	results := ProcessBatchWithOptions(ctx, []string{url}, BatchOptions{
		Concurrency:       1,
		EnrichCreditNotes: true,
	})
	if len(results) != 1 {
		t.Fatalf("len(results) = %d", len(results))
	}
	r := results[0]
	if len(r.Relacionados) == 0 {
		t.Fatal("Relacionados empty")
	}
	if r.Relacionados[0].TipoDocumentacion != "NOTA DE CRÉDITO" {
		t.Fatalf("TipoDocumentacion = %q", r.Relacionados[0].TipoDocumentacion)
	}
	if r.RelacionadosTexto == "" {
		t.Fatal("RelacionadosTexto empty")
	}
	if !r.TieneNotaCredito {
		t.Fatalf("TieneNotaCredito false, error=%q", r.NotaCreditoError)
	}
	if r.NotaCreditoEstado == "" {
		t.Fatalf("NotaCreditoEstado empty, error=%q", r.NotaCreditoError)
	}
	if r.NotaCreditoFechaEmi != "2026-05-29" {
		t.Fatalf("NotaCreditoFechaEmi = %q, want 2026-05-29", r.NotaCreditoFechaEmi)
	}
}

func TestLiveCompositeScraperRace(t *testing.T) {
	if os.Getenv("LIVE_SCRAPE") != "1" {
		t.Skip("set LIVE_SCRAPE=1 to run")
	}

	url := "https://admin.factura.gob.sv/consultaPublica?ambiente=01&codGen=94C33B18-35A3-4589-8C62-D9B68FDD6408&fechaEmi=2026-05-23"
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	scraper := NewCompositeScraper()
	result := scraper.ConsultarDTE(ctx, url)
	if result.Estado == "" && result.Error == "" {
		t.Fatalf("empty composite result")
	}
}
func TestLiveConsultAdjustedCCFF(t *testing.T) {
	if os.Getenv("LIVE_SCRAPE") != "1" {
		t.Skip("set LIVE_SCRAPE=1 to run")
	}

	url := "https://admin.factura.gob.sv/consultaPublica?ambiente=01&codGen=94C33B18-35A3-4589-8C62-D9B68FDD6408&fechaEmi=2026-05-23"
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	result := ConsultarDTE(ctx, url)
	b, _ := json.MarshalIndent(result, "", "  ")
	t.Logf("result: %s", string(b))

	if len(result.Relacionados) == 0 {
		t.Fatal("Relacionados empty")
	}
	if result.RelacionadosTexto == "" {
		t.Fatal("RelacionadosTexto empty")
	}
}

func BenchmarkLiveScraperEngine(b *testing.B) {
	if os.Getenv("LIVE_SCRAPE") != "1" {
		b.Skip("set LIVE_SCRAPE=1 to run")
	}

	url := "https://admin.factura.gob.sv/consultaPublica?ambiente=01&codGen=94C33B18-35A3-4589-8C62-D9B68FDD6408&fechaEmi=2026-05-23"
	useRod := os.Getenv("GO_DTE_USE_ROD") == "1"
	useBrowser := os.Getenv("GO_DTE_USE_BROWSER") == "1"
	engine := "composite-http"
	if useBrowser {
		engine = "chromedp"
		if useRod {
			engine = "rod"
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
		scraper, err := newConsultaScraper(ctx, useRod, useBrowser, false)
		if err != nil {
			cancel()
			b.Fatalf("newConsultaScraper: %v", err)
		}
		start := time.Now()
		result := scraper.ConsultarDTE(ctx, url)
		scraper.Close()
		cancel()
		b.ReportMetric(float64(time.Since(start).Milliseconds()), "ms/op")
		if result.Estado == "ERROR" {
			b.Fatalf("scrape error: %s", result.Error)
		}
	}
	b.Logf("engine=%s iterations=%d", engine, b.N)
}
