package shared

import (
	"strings"
	"testing"
)

const relatedDocumentsHTML = `
<html><body>
<h3>Documentos Relacionados (1)</h3>
<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Fecha de Generación</th>
      <th>Código de Generación</th>
      <th>Sello de Recepción</th>
      <th>Tipo de Documento</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>29/05/2026 16:23:37</td>
      <td>AC150EFF-E3D6-4FB8-A7D4-9339657B2415</td>
      <td>202695B5542C53E74802A17EBB13A2EB0F03HG6M</td>
      <td>NOTA DE CRÉDITO</td>
    </tr>
  </tbody>
</table>
</body></html>
`

func TestExtractRelatedWithTipoDocumento(t *testing.T) {
	rows := extractRelated(relatedDocumentsHTML)
	if len(rows) != 1 {
		t.Fatalf("len(rows) = %d, want 1", len(rows))
	}
	if rows[0].CodigoGeneracion != "AC150EFF-E3D6-4FB8-A7D4-9339657B2415" {
		t.Fatalf("CodigoGeneracion = %q", rows[0].CodigoGeneracion)
	}
	if rows[0].SelloRecepcion != "202695B5542C53E74802A17EBB13A2EB0F03HG6M" {
		t.Fatalf("SelloRecepcion = %q", rows[0].SelloRecepcion)
	}
	if !IsNotaCreditoTipo(rows[0].TipoDocumentacion) {
		t.Fatalf("TipoDocumentacion = %q, expected nota de credito", rows[0].TipoDocumentacion)
	}
}

func TestFechaEmiFromGeneracion(t *testing.T) {
	got := FechaEmiFromGeneracion("29/05/2026 16:23:37")
	want := "2026-05-29"
	if got != want {
		t.Fatalf("FechaEmiFromGeneracion() = %q, want %q", got, want)
	}
}

func TestPickNotaCredito(t *testing.T) {
	rel := []RelatedDocument{
		{TipoDocumentacion: "FACTURA", CodigoGeneracion: "X"},
		{TipoDocumentacion: "NOTA DE CRÉDITO", CodigoGeneracion: "AC150EFF-E3D6-4FB8-A7D4-9339657B2415"},
	}
	nc := PickNotaCredito(rel)
	if nc == nil || nc.CodigoGeneracion != "AC150EFF-E3D6-4FB8-A7D4-9339657B2415" {
		t.Fatalf("PickNotaCredito() = %+v", nc)
	}

	fallback := PickNotaCredito([]RelatedDocument{{
		TipoDocumentacion: "202695B5542C53E74802A17EBB13A2EB0F03HG6M",
		CodigoGeneracion:  "AC150EFF-E3D6-4FB8-A7D4-9339657B2415",
	}})
	if fallback == nil || fallback.CodigoGeneracion != "AC150EFF-E3D6-4FB8-A7D4-9339657B2415" {
		t.Fatalf("PickNotaCredito fallback = %+v", fallback)
	}
}

func TestMapHTMLResultExtractsRelacionadosWithoutAjustadoFlag(t *testing.T) {
	base := Result{
		CodGen:   "PARENT-CODE",
		FechaEmi: "2026-05-01",
		Ambiente: "01",
	}
	detail := MapHTMLResult(relatedDocumentsHTML, base)
	if len(detail.Relacionados) != 1 {
		t.Fatalf("len(Relacionados) = %d, want 1", len(detail.Relacionados))
	}
}

func TestRelacionadosTextoFromHTML(t *testing.T) {
	base := Result{CodGen: "PARENT-CODE", FechaEmi: "2026-05-01", Ambiente: "01"}
	detail := MapHTMLResult(relatedDocumentsHTML, base)
	if detail.RelacionadosTexto == "" {
		t.Fatal("RelacionadosTexto is empty")
	}
	if !strings.Contains(detail.RelacionadosTexto, "NOTA DE CRÉDITO") {
		t.Fatalf("RelacionadosTexto = %q", detail.RelacionadosTexto)
	}
	if !strings.Contains(detail.RelacionadosTexto, "AC150EFF-E3D6-4FB8-A7D4-9339657B2415") {
		t.Fatalf("RelacionadosTexto = %q", detail.RelacionadosTexto)
	}
}

const observationsHTML = `
<html><body>
<h3>Observaciones (1)</h3>
<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Observación</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Documento anulado por nota de crédito</td>
    </tr>
  </tbody>
</table>
</body></html>
`

func TestExtractObservations(t *testing.T) {
	rows := extractObservations(observationsHTML)
	if len(rows) != 1 {
		t.Fatalf("len(rows) = %d, want 1", len(rows))
	}
	if rows[0].Observacion != "Documento anulado por nota de crédito" {
		t.Fatalf("Observacion = %q", rows[0].Observacion)
	}

	base := Result{CodGen: "PARENT", FechaEmi: "2026-05-01"}
	detail := MapHTMLResult(observationsHTML, base)
	if detail.ObservacionesTexto != "1. Documento anulado por nota de crédito" {
		t.Fatalf("ObservacionesTexto = %q", detail.ObservacionesTexto)
	}
}

func TestExtractRelatedSkipsEmptyCodigo(t *testing.T) {
	html := `
<table>
  <thead>
    <tr>
      <th>#</th><th>Fecha de Generación</th><th>Código de Generación</th>
      <th>Sello de Recepción</th><th>Tipo de Documento</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td><td>29/05/2026</td><td>AC150EFF-E3D6-4FB8-A7D4-9339657B2415</td>
      <td>SELLO1</td><td>NOTA DE CRÉDITO</td>
    </tr>
    <tr><td>2</td><td></td><td></td><td></td><td></td></tr>
  </tbody>
</table>`
	rows := extractRelated(html)
	if len(rows) != 1 {
		t.Fatalf("len(rows) = %d, want 1 (empty row skipped)", len(rows))
	}
}

func TestExtractRelatedTipoColumnFallback(t *testing.T) {
	html := `
<table>
  <thead><tr>
    <th>#</th><th>Fecha de Generación</th><th>Código de Generación</th>
    <th>Sello de Recepción</th><th>Tipo Doc</th>
  </tr></thead>
  <tbody><tr>
    <td>1</td><td>29/05/2026</td><td>AC150EFF-E3D6-4FB8-A7D4-9339657B2415</td>
    <td>SELLO1</td><td>NOTA DE CRÉDITO</td>
  </tr></tbody>
</table>`
	rows := extractRelated(html)
	if len(rows) != 1 || rows[0].TipoDocumentacion != "NOTA DE CRÉDITO" {
		t.Fatalf("rows = %+v", rows)
	}
}

const portalAdjustedCCFFHTML = `
<html><body>
<label>Estado del DTE:</label><label>Transmitido Satisfactoriamente</label>
<label>Código de Generación:</label><label>94C33B18-35A3-4589-8C62-D9B68FDD6408</label>
<label>Documento ajustado:</label><label>El documento ha sido ajustado</label>
<label>Documentos Relacionados (1)</label>
<table id="DataTables_Table_0" class="display table table-striped table-hover dataTable no-footer">
  <thead>
    <tr>
      <th>#</th>
      <th>Fecha de Generación</th>
      <th>Código de Generación</th>
      <th>Sello de Recepción</th>
      <th>Tipo de Documento</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><small>1</small></td>
      <td><small>29/05/2026 16:23:37</small></td>
      <td><small>AC150EFF-E3D6-4FB8-A7D4-9339657B2415</small></td>
      <td><small>202695B5542C53E74802A17EBB13A2EB0F03HG6M</small></td>
      <td><small>NOTA DE CRÉDITO</small></td>
    </tr>
  </tbody>
</table>
<p><b>Detalle de Observaciones asociadas al Documento Tributario Electrónico</b></p>
<table id="DataTables_Table_1" class="table display responsive dataTable no-footer">
  <thead>
    <tr><th>#</th><th>Observación</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><small>1</small></td>
      <td><small>[identificacion.fecEmi] DIFIERE DE LA FECHA DE ENVIO</small></td>
    </tr>
  </tbody>
</table>
</body></html>
`

func TestExtractRelatedPortalHTML(t *testing.T) {
	rows := extractRelated(portalAdjustedCCFFHTML)
	if len(rows) != 1 {
		t.Fatalf("len(rows) = %d, want 1", len(rows))
	}
	if rows[0].CodigoGeneracion != "AC150EFF-E3D6-4FB8-A7D4-9339657B2415" {
		t.Fatalf("CodigoGeneracion = %q", rows[0].CodigoGeneracion)
	}
	if rows[0].TipoDocumentacion != "NOTA DE CRÉDITO" {
		t.Fatalf("TipoDocumentacion = %q", rows[0].TipoDocumentacion)
	}

	base := Result{
		CodGen:   "94C33B18-35A3-4589-8C62-D9B68FDD6408",
		FechaEmi: "2026-05-23",
		Ambiente: "01",
	}
	detail := MapHTMLResult(portalAdjustedCCFFHTML, base)
	if len(detail.Relacionados) != 1 {
		t.Fatalf("len(Relacionados) = %d, want 1", len(detail.Relacionados))
	}
	if detail.RelacionadosTexto == "" {
		t.Fatal("RelacionadosTexto is empty")
	}
	if len(detail.Observaciones) != 1 {
		t.Fatalf("len(Observaciones) = %d, want 1", len(detail.Observaciones))
	}
}

func TestScrapeReadyNeedsTwoUUIDsWhenAdjusted(t *testing.T) {
	earlyHTML := stripTags(`
		Estado del DTE: Transmitido Satisfactoriamente
		Código de Generación: 94C33B18-35A3-4589-8C62-D9B68FDD6408
		Documento ajustado: El documento ha sido ajustado
		Documentos Relacionados (1)
	`)
	if scrapeReadyFromText(earlyHTML) {
		t.Fatal("early HTML without related UUID should not be scrape-ready")
	}

	fullText := stripTags(portalAdjustedCCFFHTML)
	if !scrapeReadyFromText(fullText) {
		t.Fatal("portal HTML with parent + related UUID should be scrape-ready")
	}
}

func TestApplyNotaCreditoFieldsSetsFechaEmiAndVerified(t *testing.T) {
	parent := &Result{}
	nc := &RelatedDocument{
		CodigoGeneracion:  "AC150EFF-E3D6-4FB8-A7D4-9339657B2415",
		SelloRecepcion:    "202695B5542C53E74802A17EBB13A2EB0F03HG6M",
		FechaGeneracion:   "29/05/2026 16:23:37",
		TipoDocumentacion: "NOTA DE CRÉDITO",
	}
	verified := Result{
		Estado:         "EMITIDO",
		EstadoRaw:      "Emitido",
		NumeroControl:  "NC-001",
		MontoTotal:     "100.00",
		LinkVisita:     "https://admin.factura.gob.sv/consulta?codGen=AC150EFF",
	}

	applyNotaCreditoFields(parent, nc, verified, nil)

	if !parent.TieneNotaCredito {
		t.Fatal("TieneNotaCredito should be true")
	}
	if parent.NotaCreditoFechaEmi != "2026-05-29" {
		t.Fatalf("NotaCreditoFechaEmi = %q, want 2026-05-29", parent.NotaCreditoFechaEmi)
	}
	if parent.NotaCreditoNumeroControl != "NC-001" {
		t.Fatalf("NotaCreditoNumeroControl = %q", parent.NotaCreditoNumeroControl)
	}
	if parent.NotaCreditoMontoTotal != "100.00" {
		t.Fatalf("NotaCreditoMontoTotal = %q", parent.NotaCreditoMontoTotal)
	}
	if parent.NotaCreditoEstado != "EMITIDO" {
		t.Fatalf("NotaCreditoEstado = %q", parent.NotaCreditoEstado)
	}
}

func TestApplyNotaCreditoFieldsSetsFechaEmiOnError(t *testing.T) {
	parent := &Result{}
	nc := &RelatedDocument{
		CodigoGeneracion: "AC150EFF-E3D6-4FB8-A7D4-9339657B2415",
		FechaGeneracion:  "29/05/2026 16:23:37",
	}

	applyNotaCreditoFields(parent, nc, Result{}, errMissingNCDate)

	if parent.NotaCreditoFechaEmi != "2026-05-29" {
		t.Fatalf("NotaCreditoFechaEmi = %q on error path", parent.NotaCreditoFechaEmi)
	}
	if parent.NotaCreditoError == "" {
		t.Fatal("NotaCreditoError should be set")
	}
}
