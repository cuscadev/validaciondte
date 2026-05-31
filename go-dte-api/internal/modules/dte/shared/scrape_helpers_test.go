package shared

import "testing"

func TestShouldRetryScrape(t *testing.T) {
	if !shouldRetryScrape(Result{Error: "i/o timeout"}, nil) {
		t.Fatal("expected retry on network timeout message")
	}
	if shouldRetryScrape(Result{Estado: "ERROR", Error: "Hacienda respondio HTTP 404"}, nil) {
		t.Fatal("should not retry business HTTP errors")
	}
	if shouldRetryScrape(Result{Estado: "NO ENCONTRADO"}, nil) {
		t.Fatal("should not retry NO ENCONTRADO")
	}
	if shouldRetryScrape(Result{Estado: "EMITIDO"}, nil) {
		t.Fatal("should not retry EMITIDO")
	}
}

func TestDedupeLinks(t *testing.T) {
	links := []string{
		"https://admin.factura.gob.sv/consultaPublica?ambiente=01&codGen=AA&fechaEmi=2026-01-01",
		"https://admin.factura.gob.sv/consultaPublica?ambiente=01&codGen=AA&fechaEmi=2026-01-01",
		"https://admin.factura.gob.sv/consultaPublica?ambiente=01&codGen=BB&fechaEmi=2026-01-02",
	}
	plan := dedupeLinks(links)
	if len(plan.unique) != 2 {
		t.Fatalf("unique = %d", len(plan.unique))
	}
	if plan.origToUnique[0] != plan.origToUnique[1] {
		t.Fatal("duplicate links should map to same unique index")
	}
}
