package shared

import "testing"

func TestResultLookupKeyNormalizesDate(t *testing.T) {
	key := ResultLookupKey("12345678-1234-1234-1234-123456789abc", "15/01/2026")
	want := "12345678-1234-1234-1234-123456789ABC|2026-01-15"
	if key != want {
		t.Fatalf("got %q, want %q", key, want)
	}
}

func TestExtractDTEJSONFields(t *testing.T) {
	item := map[string]any{
		"identificacion": map[string]any{
			"codigoGeneracion": "12345678-1234-1234-1234-123456789ABC",
			"fecEmi":           "2026-01-15",
			"numeroControl":    "DTE-01-001-00000001",
			"tipoDte":          "01",
			"ambiente":         "01",
		},
		"resumen": map[string]any{
			"montoTotalOperacion": 100.0,
			"totalPagar":          113.0,
			"totalIva":            13.0,
		},
		"selloRecibido": "SELLO-123",
		"emisor": map[string]any{
			"nit":    "0614-010101-101-1",
			"nombre": "EMPRESA SA",
		},
		"receptor": map[string]any{
			"nit":    "0614-020202-202-2",
			"nombre": "CLIENTE SA",
		},
	}

	got := ExtractDTEJSONFields(item)
	if got.NumeroControl != "DTE-01-001-00000001" {
		t.Fatalf("NumeroControl = %q", got.NumeroControl)
	}
	if got.SelloRecepcion != "SELLO-123" {
		t.Fatalf("SelloRecepcion = %q", got.SelloRecepcion)
	}
	if got.MontoTotal != "100.00" {
		t.Fatalf("MontoTotal = %q", got.MontoTotal)
	}
	if got.TotalPagarOperacion != "113.00" {
		t.Fatalf("TotalPagarOperacion = %q", got.TotalPagarOperacion)
	}
	if got.IvaOperaciones != "13.00" {
		t.Fatalf("IvaOperaciones = %q", got.IvaOperaciones)
	}
	if got.EmisorNombre != "EMPRESA SA" {
		t.Fatalf("EmisorNombre = %q", got.EmisorNombre)
	}
}

func TestMergeJSONIntoResultFillsEmptyScrapeFields(t *testing.T) {
	scrape := Result{
		Estado:            "EMITIDO",
		DescripcionEstado: "Transmitido satisfactoriamente",
		CodGen:            "12345678-1234-1234-1234-123456789ABC",
		FechaEmi:          "2026-01-15",
	}
	jsonFields := Result{
		NumeroControl:       "DTE-01-001-00000001",
		SelloRecepcion:      "SELLO-123",
		MontoTotal:          "100.00",
		TotalPagarOperacion: "113.00",
		IvaOperaciones:      "13.00",
		EmisorNombre:        "EMPRESA SA",
	}

	MergeJSONIntoResult(&scrape, jsonFields)

	if scrape.NumeroControl != "DTE-01-001-00000001" {
		t.Fatalf("NumeroControl = %q", scrape.NumeroControl)
	}
	if scrape.SelloRecepcion != "SELLO-123" {
		t.Fatalf("SelloRecepcion = %q", scrape.SelloRecepcion)
	}
	if scrape.MontoTotal != "100.00" {
		t.Fatalf("MontoTotal = %q", scrape.MontoTotal)
	}
	if scrape.EmisorNombre != "EMPRESA SA" {
		t.Fatalf("EmisorNombre = %q", scrape.EmisorNombre)
	}
	if scrape.Estado != "EMITIDO" {
		t.Fatalf("Estado should remain from scrape, got %q", scrape.Estado)
	}
}

func TestMergeJSONIntoResultDoesNotOverwriteScrapeValues(t *testing.T) {
	scrape := Result{
		SelloRecepcion: "SELLO-SCRAPE",
		MontoTotal:     "200.00",
	}
	jsonFields := Result{
		SelloRecepcion: "SELLO-JSON",
		MontoTotal:     "100.00",
	}

	MergeJSONIntoResult(&scrape, jsonFields)

	if scrape.SelloRecepcion != "SELLO-SCRAPE" {
		t.Fatalf("SelloRecepcion = %q", scrape.SelloRecepcion)
	}
	if scrape.MontoTotal != "200.00" {
		t.Fatalf("MontoTotal = %q", scrape.MontoTotal)
	}
}
