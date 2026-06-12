//verificador-dte/internal/modules/dte/shared/tributos_test.go
package shared

import "testing"

func TestTributoColumnName(t *testing.T) {
	if got := tributoColumnName("C8"); got != "cotrans" {
		t.Fatalf("C8 = %q, want cotrans", got)
	}
	if got := tributoColumnName("D1"); got != "fovial" {
		t.Fatalf("D1 = %q, want fovial", got)
	}
	if got := tributoColumnName("XX"); got != "tributo_XX" {
		t.Fatalf("XX = %q, want tributo_XX", got)
	}
}

func TestParseOtrosTributosText(t *testing.T) {
	got := ParseOtrosTributosText("C8: 1.24; D1: 2.48")
	if got["C8"] != "1.24" || got["D1"] != "2.48" {
		t.Fatalf("parsed = %#v", got)
	}
}

func TestCollectTributosFromAPISkipsIVA(t *testing.T) {
	items := []publicAPITributo{
		{Codigo: "20", Valor: floatPtr(10.53)},
		{Codigo: "C8", Valor: floatPtr(1.24)},
	}
	got := CollectTributosFromAPI(items)
	if len(got) != 1 || got["C8"] != "1.24" {
		t.Fatalf("got = %#v", got)
	}
}

func TestResultRowTributoValues(t *testing.T) {
	result := Result{TributosPorCodigo: map[string]string{"C8": "1.24", "D1": "2.48"}}
	codes := CollectTributoCodes([]Result{result})
	row := resultRow(result, codes)
	headers := buildReportHeaders([]Result{result})
	c8Idx := -1
	d1Idx := -1
	for i, h := range headers {
		if h == "cotrans" {
			c8Idx = i
		}
		if h == "fovial" {
			d1Idx = i
		}
	}
	if c8Idx < 0 || d1Idx < 0 {
		t.Fatalf("headers = %v", headers)
	}
	if row[c8Idx] != "1.24" || row[d1Idx] != "2.48" {
		t.Fatalf("row tributo values = %v / %v", row[c8Idx], row[d1Idx])
	}
}
