package shared

import "testing"

func TestPairsFromHTMLFourColumnTable(t *testing.T) {
	html := `<html><body><table>
		<tr><th>Estado del DTE</th><td>Transmitido</td><th>Tipo de DTE</th><td>Factura</td></tr>
	</table></body></html>`

	pairs := pairsFromHTML(html)
	detail := mapDetail(pairs)

	if detail.TipoDte != "Factura" {
		t.Fatalf("TipoDte = %q, want Factura", detail.TipoDte)
	}
	if detail.TipoDteNorm != "FACTURA" {
		t.Fatalf("TipoDteNorm = %q, want FACTURA", detail.TipoDteNorm)
	}
}

func TestPairsFromHTMLDefinitionList(t *testing.T) {
	html := `<html><body><dl>
		<dt>Tipo de DTE</dt><dd>Factura</dd>
	</dl></body></html>`

	pairs := pairsFromHTML(html)
	detail := mapDetail(pairs)

	if detail.TipoDte != "Factura" {
		t.Fatalf("TipoDte = %q, want Factura", detail.TipoDte)
	}
	if detail.TipoDteNorm != "FACTURA" {
		t.Fatalf("TipoDteNorm = %q, want FACTURA", detail.TipoDteNorm)
	}
}

func TestApplyTipoDteTextFallback(t *testing.T) {
	html := `<html><body><div>Tipo de DTE: Comprobante de Crédito Fiscal</div></body></html>`
	detail := Result{}

	applyTipoDteTextFallback(html, &detail)

	if detail.TipoDte != "Comprobante de Crédito Fiscal" {
		t.Fatalf("TipoDte = %q", detail.TipoDte)
	}
	if detail.TipoDteNorm != "COMPROBANTE DE CREDITO FISCAL" {
		t.Fatalf("TipoDteNorm = %q, want COMPROBANTE DE CREDITO FISCAL", detail.TipoDteNorm)
	}
}

func TestNormalizarTipoDteNumericCodes(t *testing.T) {
	cases := map[string]string{
		"01": "FACTURA",
		"03": "COMPROBANTE DE CREDITO FISCAL",
		"05": "NOTA DE CREDITO",
		"09": "COMPROBANTE DE LIQUIDACION",
		"14": "FACTURA SUJETO EXCLUIDO",
	}
	for input, want := range cases {
		if got := NormalizarTipoDte(input); got != want {
			t.Fatalf("NormalizarTipoDte(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestMergeJSONIntoResultRecalculatesTipoDteNorm(t *testing.T) {
	scrape := Result{
		Estado:      "EMITIDO",
		TipoDte:     "01",
		TipoDteNorm: "SIN_TIPO",
	}
	jsonFields := Result{
		TipoDte:     "01",
		TipoDteNorm: "FACTURA",
	}

	MergeJSONIntoResult(&scrape, jsonFields)

	if scrape.TipoDteNorm != "FACTURA" {
		t.Fatalf("TipoDteNorm = %q, want FACTURA", scrape.TipoDteNorm)
	}
}
