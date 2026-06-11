package shared

import (
	"testing"
)

func TestReportHeadersMatchResultRow(t *testing.T) {
	results := []Result{{
		TributosPorCodigo: map[string]string{"C8": "1.24", "D1": "2.48"},
	}}
	headers := buildReportHeaders(results)
	tributoCodes := CollectTributoCodes(results)
	row := resultRow(results[0], tributoCodes)
	if len(row) != len(headers) {
		t.Fatalf("len(resultRow) = %d, len(headers) = %d", len(row), len(headers))
	}
}

func TestReportHeadersIncludeTributoColumns(t *testing.T) {
	results := []Result{{
		OtrosTributos: "C8: 1.24; D1: 2.48",
	}}
	headers := buildReportHeaders(results)
	if !containsString(headers, "tributo_C8") || !containsString(headers, "tributo_D1") {
		t.Fatalf("headers = %v", headers)
	}
	if !containsString(headers, "otrosTributos") {
		t.Fatal("otrosTributos must always be in excel headers")
	}
}

func TestReportHeadersAlwaysIncludeOtrosTributos(t *testing.T) {
	headers := buildReportHeaders(nil)
	if !containsString(headers, "otrosTributos") {
		t.Fatalf("headers = %v", headers)
	}
}

func TestReportHeadersNCBlockOrder(t *testing.T) {
	wantAfterAjustado := []string{
		"tieneNotaCredito",
		"notaCreditoCodigoGeneracion",
		"notaCreditoFechaGeneracion",
		"notaCreditoFechaEmi",
		"notaCreditoSelloRecepcion",
		"notaCreditoTipoDocumento",
		"notaCreditoEstado",
		"notaCreditoEstadoRaw",
		"notaCreditoNumeroControl",
		"notaCreditoMontoTotal",
		"notaCreditoLinkVisita",
		"notaCreditoError",
		"relacionadosTexto",
	}

	headers := buildReportHeaders(nil)
	idx := -1
	for i, h := range headers {
		if h == "ajustado" {
			idx = i
			break
		}
	}
	if idx < 0 {
		t.Fatal("ajustado header not found")
	}
	if headers[idx+1] != "documentoAjustado" {
		t.Fatalf("after ajustado got %q, want documentoAjustado", headers[idx+1])
	}

	got := headers[idx+2 : idx+2+len(wantAfterAjustado)]
	for i := range wantAfterAjustado {
		if got[i] != wantAfterAjustado[i] {
			t.Fatalf("NC block[%d] = %q, want %q", i, got[i], wantAfterAjustado[i])
		}
	}
}

func TestHeaderColumnNotaCreditoLink(t *testing.T) {
	headers := buildReportHeaders(nil)
	col := headerColumnIn(headers, "notaCreditoLinkVisita")
	if col <= 0 {
		t.Fatal("notaCreditoLinkVisita column not found")
	}
	if headers[col-1] != "notaCreditoLinkVisita" {
		t.Fatalf("header at col %d = %q", col, headers[col-1])
	}
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}
