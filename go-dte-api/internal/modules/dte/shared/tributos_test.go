package shared

import "testing"

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
		if h == "tributo_C8" {
			c8Idx = i
		}
		if h == "tributo_D1" {
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
