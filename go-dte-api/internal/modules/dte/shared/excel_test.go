package shared

import (
	"testing"
)

func TestReportHeadersMatchResultRow(t *testing.T) {
	row := resultRow(Result{})
	if len(row) != len(reportHeaders) {
		t.Fatalf("len(resultRow) = %d, len(reportHeaders) = %d", len(row), len(reportHeaders))
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

	idx := -1
	for i, h := range reportHeaders {
		if h == "ajustado" {
			idx = i
			break
		}
	}
	if idx < 0 {
		t.Fatal("ajustado header not found")
	}
	if reportHeaders[idx+1] != "documentoAjustado" {
		t.Fatalf("after ajustado got %q, want documentoAjustado", reportHeaders[idx+1])
	}

	got := reportHeaders[idx+2 : idx+2+len(wantAfterAjustado)]
	for i := range wantAfterAjustado {
		if got[i] != wantAfterAjustado[i] {
			t.Fatalf("NC block[%d] = %q, want %q", i, got[i], wantAfterAjustado[i])
		}
	}
}

func TestHeaderColumnNotaCreditoLink(t *testing.T) {
	col := headerColumn("notaCreditoLinkVisita")
	if col <= 0 {
		t.Fatal("notaCreditoLinkVisita column not found")
	}
	if reportHeaders[col-1] != "notaCreditoLinkVisita" {
		t.Fatalf("header at col %d = %q", col, reportHeaders[col-1])
	}
}
