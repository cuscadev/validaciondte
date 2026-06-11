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

func TestMapDetailReadsHaciendaConsultaFields(t *testing.T) {
	html := `<html><body>
		<div class="form-group row"><label>Fecha y Hora de TransmisiÃ³n:</label><div><label>2026-05-02 12:07:49</label></div></div>
		<div class="form-group row"><label>IVA de las operaciones:</label><div><label>$12.70</label></div></div>
		<div class="form-group row"><label>IVA percibido:</label><div><label>$0.00</label></div></div>
		<div class="form-group row"><label>IVA retenido:</label><div><label>$0.00</label></div></div>
		<div class="form-group row"><label>RetenciÃ³n renta:</label><div><label>$0.00</label></div></div>
		<div class="form-group row"><label>Total Valores no Afectos:</label><div><label>$0.00</label></div></div>
		<div class="form-group row"><label>Total de OperaciÃ³n:</label><div><label>$110.40</label></div></div>
		<div class="form-group row"><label>Documento ajustado:</label><div><label>El documento no ha sido ajustado</label></div></div>
		<div class="form-group row"><label>Documento con Evento aplicado:</label><div><label>NO</label></div></div>
	</body></html>`

	detail := mapDetail(pairsFromHTML(html))

	if detail.FechaHoraTransmision != "2026-05-02 12:07:49" {
		t.Fatalf("FechaHoraTransmision = %q", detail.FechaHoraTransmision)
	}
	if detail.IvaOperaciones != "$12.70" {
		t.Fatalf("IvaOperaciones = %q", detail.IvaOperaciones)
	}
	if detail.IvaPercibido != "$0.00" || detail.IvaRetenido != "$0.00" || detail.RetencionRenta != "$0.00" {
		t.Fatalf("IVA/retenciones = %q/%q/%q", detail.IvaPercibido, detail.IvaRetenido, detail.RetencionRenta)
	}
	if detail.TotalNoAfectos != "$0.00" {
		t.Fatalf("TotalNoAfectos = %q", detail.TotalNoAfectos)
	}
	if detail.TotalPagarOperacion != "$110.40" {
		t.Fatalf("TotalPagarOperacion = %q", detail.TotalPagarOperacion)
	}
	if detail.DocumentoAjustado != "El documento no ha sido ajustado" {
		t.Fatalf("DocumentoAjustado = %q", detail.DocumentoAjustado)
	}
	if detail.DocumentoEventoAplicado != "NO" {
		t.Fatalf("DocumentoEventoAplicado = %q", detail.DocumentoEventoAplicado)
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

func TestMapDetailReadsComprobanteRetencionFields(t *testing.T) {
	html := `<html><body>
		<div class="form-group row"><label>Estado del DTE:</label><div><label>Transmitido Satisfactoriamente</label></div></div>
		<div class="form-group row"><label>Descripción del DTE:</label><div><label>DTE transmitido y registrado satisfactoriamente en la DGII.</label></div></div>
		<div class="form-group row"><label> Tipo de DTE: </label><div><label>COMPROBANTE DE RETENCIÓN</label></div></div>
		<div class="form-group row"><label>Fecha y Hora de Generación:</label><div><label>2026-05-07 12:02:50</label></div></div>
		<div class="form-group row"><label>Fecha y Hora de Transmisión:</label><div><label>2026-05-07 12:03:18</label></div></div>
		<div class="form-group row"><label>Código de Generación:</label><div><label>63AE94E9-2A91-490E-85A6-439D509D3043</label></div></div>
		<div class="form-group row"><label>Sello de Recepción:</label><div><label>2026A2A5FDF9C1824918B404D3B0D5051BF57KCP</label></div></div>
		<div class="form-group row"><label>Número de Control:</label><div><label>DTE-07-M001P005-000000000000598</label></div></div>
		<div class="form-group row"><label>Monto Total de la Operación:</label><div><label>$354.40</label></div></div>
		<div class="form-group row"><label>IVA de las operaciones:</label><div><label>$0.00</label></div></div>
		<div class="form-group row"><label>IVA percibido:</label><div><label>$0.00</label></div></div>
		<div class="form-group row"><label>IVA retenido:</label><div><label>$3.54</label></div></div>
		<div class="form-group row"><label>Retención renta:</label><div><label>$0.00</label></div></div>
		<div class="form-group row"><label>Total Valores no Afectos:</label><div><label>$0.00</label></div></div>
		<div class="form-group row"><label>Total de Operación:</label><div><label>$3.54</label></div></div>
		<div class="form-group row"><label>Documento ajustado:</label><div><label>El documento no ha sido ajustado</label></div></div>
		<div class="form-group row"><label>Documento con Evento aplicado:</label><div><label>NO</label></div></div>
	</body></html>`

	detail := mapDetail(pairsFromHTML(html))

	if detail.TipoDteNorm != "COMPROBANTE DE RETENCION" {
		t.Fatalf("TipoDteNorm = %q, want COMPROBANTE DE RETENCION", detail.TipoDteNorm)
	}
	if detail.MontoTotalOperacion != "$354.40" {
		t.Fatalf("MontoTotalOperacion = %q", detail.MontoTotalOperacion)
	}
	if detail.MontoTotal != "$354.40" {
		t.Fatalf("MontoTotal = %q", detail.MontoTotal)
	}
	if detail.TotalPagarOperacion != "$3.54" {
		t.Fatalf("TotalPagarOperacion = %q", detail.TotalPagarOperacion)
	}
	if detail.IvaRetenido != "$3.54" {
		t.Fatalf("IvaRetenido = %q", detail.IvaRetenido)
	}
	if detail.DocumentoEventoAplicado != "NO" {
		t.Fatalf("DocumentoEventoAplicado = %q", detail.DocumentoEventoAplicado)
	}
}

func TestNormalizarTipoDteNumericCodes(t *testing.T) {
	cases := map[string]string{
		"01": "FACTURA",
		"03": "COMPROBANTE DE CREDITO FISCAL",
		"05": "NOTA DE CREDITO",
		"07": "COMPROBANTE DE RETENCION",
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
