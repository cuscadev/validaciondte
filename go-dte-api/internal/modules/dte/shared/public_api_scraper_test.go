package shared

import "testing"

func TestMapPublicAPIResponseSuccess(t *testing.T) {
	payload := publicAPIResponse{
		EstadoDoc:         "Transmitido Satisfactoriamente",
		DescripcionEstado: "Documento Recibido con Observaciones",
		FechaEmi:          "2026-05-23",
		HoraEmi:           "09:50:32",
		FechaProcesado:    "2026-05-27 09:50:32",
		CodGen:            "94C33B18-35A3-4589-8C62-D9B68FDD6408",
		SelloVal:          "SELLO-TEST",
		Action:            "OK",
		TipoDte:           "03",
		NombDte:           "COMPROBANTE DE CREDITO FISCAL",
		Observaciones:     []string{"obs 1"},
		Ajustes: []publicAPIAjuste{
			{
				TipDteRef:           "05",
				CodigoGeneracionRef: "AC150EFF-E3D6-4FB8-A7D4-9339657B2415",
				NumValidacionRef:    "SELLO-NC",
				FecHorEmi:           "Fri May 29 16:23:37 CST 2026",
			},
		},
		Documento: &publicAPIDocumento{},
	}
	payload.Documento.Identificacion.NumeroControl = "DTE-03-001"

	base := baseErrorResult(
		"https://admin.factura.gob.sv/consultaPublica?ambiente=01&codGen=94C33B18-35A3-4589-8C62-D9B68FDD6408&fechaEmi=2026-05-23",
		nil,
	)

	result := mapPublicAPIResponse(payload, base)
	if !result.OK {
		t.Fatalf("expected ok result, got estado=%q error=%q", result.Estado, result.Error)
	}
	if result.Estado != "EMITIDO" {
		t.Fatalf("Estado = %q, want EMITIDO", result.Estado)
	}
	if result.NumeroControl != "DTE-03-001" {
		t.Fatalf("NumeroControl = %q", result.NumeroControl)
	}
	if len(result.Relacionados) != 1 {
		t.Fatalf("len(Relacionados) = %d, want 1", len(result.Relacionados))
	}
	if result.Relacionados[0].TipoDocumentacion != "NOTA DE CREDITO" {
		t.Fatalf("tipo relacionado = %q", result.Relacionados[0].TipoDocumentacion)
	}
}

func TestMapPublicAPIResponseReadsDteResumenTaxAliases(t *testing.T) {
	payload := publicAPIResponse{
		EstadoDoc:         "Transmitido Satisfactoriamente",
		DescripcionEstado: "Documento Recibido con Observaciones",
		FechaEmi:          "2026-03-04",
		HoraEmi:           "14:25:02",
		FechaProcesado:    "2026-03-05 09:51:08",
		CodGen:            "E8D688B4-060D-4502-AA03-AD4DB9B6D657",
		SelloVal:          "202608A3D1B670AF49879A538E67B1DAC60312UU",
		TipoDte:           "03",
		NombDte:           "COMPROBANTE DE CREDITO FISCAL",
		Documento:         &publicAPIDocumento{},
	}
	payload.Documento.Identificacion.NumeroControl = "DTE-03-M001P001-000000000000121"
	payload.Documento.Resumen.SubTotalVentas = floatPtr(80.00)
	payload.Documento.Resumen.MontoTotalOperacion = floatPtr(90.40)
	payload.Documento.Resumen.TotalPagar = floatPtr(90.40)
	payload.Documento.Resumen.Tributos = []publicAPITributo{{
		Codigo:      "20",
		Descripcion: "Impuesto al Valor Agregado 13%",
		Valor:       floatPtr(10.40),
	}}
	payload.Documento.Resumen.IvaPerci1 = floatPtr(0)
	payload.Documento.Resumen.IvaRete1 = floatPtr(0)
	payload.Documento.Resumen.ReteRenta = floatPtr(0)
	payload.Documento.Resumen.TotalNoGravado = floatPtr(0)

	result := mapPublicAPIResponse(payload, Result{})

	if result.MontoTotal != "80" {
		t.Fatalf("MontoTotal = %q, want 80", result.MontoTotal)
	}
	if result.IvaOperaciones != "10.4" {
		t.Fatalf("IvaOperaciones = %q, want 10.4", result.IvaOperaciones)
	}
	if result.IvaPercibido != "0" {
		t.Fatalf("IvaPercibido = %q, want 0", result.IvaPercibido)
	}
	if result.IvaRetenido != "0" {
		t.Fatalf("IvaRetenido = %q, want 0", result.IvaRetenido)
	}
	if result.RetencionRenta != "0" {
		t.Fatalf("RetencionRenta = %q, want 0", result.RetencionRenta)
	}
	if result.TotalNoAfectos != "0" {
		t.Fatalf("TotalNoAfectos = %q, want 0", result.TotalNoAfectos)
	}
	if result.TotalPagarOperacion != "90.4" {
		t.Fatalf("TotalPagarOperacion = %q, want 90.4", result.TotalPagarOperacion)
	}
	if result.FechaHoraTransmision != "2026-03-05 09:51:08" {
		t.Fatalf("FechaHoraTransmision = %q", result.FechaHoraTransmision)
	}
	if result.DocumentoAjustado != "El documento no ha sido ajustado" {
		t.Fatalf("DocumentoAjustado = %q", result.DocumentoAjustado)
	}
	if result.DocumentoEventoAplicado != "NO" {
		t.Fatalf("DocumentoEventoAplicado = %q", result.DocumentoEventoAplicado)
	}
}

func TestMapPublicAPIResponseReadsComprobanteRetencionAmounts(t *testing.T) {
	payload := publicAPIResponse{
		EstadoDoc:         "Transmitido Satisfactoriamente",
		DescripcionEstado: "DTE transmitido y registrado satisfactoriamente en la DGII.",
		FechaEmi:          "2026-05-07",
		HoraEmi:           "12:02:50",
		FechaProcesado:    "2026-05-07 12:03:18",
		CodGen:            "63AE94E9-2A91-490E-85A6-439D509D3043",
		SelloVal:          "2026A2A5FDF9C1824918B404D3B0D5051BF57KCP",
		TipoDte:           "07",
		NombDte:           "COMPROBANTE DE RETENCION",
		Documento:         &publicAPIDocumento{},
	}
	payload.Documento.Identificacion.NumeroControl = "DTE-07-M001P005-000000000000598"
	payload.Documento.Resumen.MontoTotalOperacion = floatPtr(354.40)
	payload.Documento.Resumen.TotalPagar = floatPtr(3.54)
	payload.Documento.Resumen.IvaRete1 = floatPtr(3.54)

	result := mapPublicAPIResponse(payload, Result{})

	if result.TipoDteNorm != "COMPROBANTE DE RETENCION" {
		t.Fatalf("TipoDteNorm = %q", result.TipoDteNorm)
	}
	if result.MontoTotalOperacion != "354.4" {
		t.Fatalf("MontoTotalOperacion = %q, want 354.4", result.MontoTotalOperacion)
	}
	if result.MontoTotal != "354.4" {
		t.Fatalf("MontoTotal = %q, want 354.4", result.MontoTotal)
	}
	if result.TotalPagarOperacion != "3.54" {
		t.Fatalf("TotalPagarOperacion = %q, want 3.54", result.TotalPagarOperacion)
	}
	if result.IvaRetenido != "3.54" {
		t.Fatalf("IvaRetenido = %q, want 3.54", result.IvaRetenido)
	}
}

func TestMapPublicAPIResponseReadsComprobanteRetencionHaciendaVariants(t *testing.T) {
	payload := publicAPIResponse{
		EstadoDoc:         "Transmitido Satisfactoriamente",
		DescripcionEstado: "Transmitido Satisfactoriamente con Observaciones",
		FechaEmi:          "2026-05-25",
		HoraEmi:           "12:56:08",
		FechaProcesado:    "2026-05-27 12:56:08",
		CodGen:            "EE0B3BE4-2C7A-4936-9DA9-6DE28061B12F",
		TipoDte:           "07",
		NombDte:           "COMPROBANTE DE RETENCION",
		Documento:         &publicAPIDocumento{},
	}
	payload.Documento.Identificacion.NumeroControl = "DTE-07-M001P001-000000000003369"
	payload.Documento.Resumen.TotalSujetoRetencion = floatPtr(425)
	payload.Documento.Resumen.TotalIVAretenido = floatPtr(4.25)

	result := mapPublicAPIResponse(payload, Result{})

	if result.MontoTotalOperacion != "425" {
		t.Fatalf("MontoTotalOperacion = %q, want 425", result.MontoTotalOperacion)
	}
	if result.MontoTotal != "425" {
		t.Fatalf("MontoTotal = %q, want 425", result.MontoTotal)
	}
	if result.TotalPagarOperacion != "4.25" {
		t.Fatalf("TotalPagarOperacion = %q, want 4.25", result.TotalPagarOperacion)
	}
	if result.IvaRetenido != "4.25" {
		t.Fatalf("IvaRetenido = %q, want 4.25", result.IvaRetenido)
	}
}

func TestMapPublicAPIResponseReadsCreditoFiscalRealPayload26FA8ABC(t *testing.T) {
	payload := publicAPIResponse{
		EstadoDoc:         "Transmitido Satisfactoriamente",
		DescripcionEstado: "Documento Recibido",
		FechaEmi:          "2025-05-02",
		HoraEmi:           "10:07:23",
		FechaProcesado:    "2025-05-02 10:07:24",
		CodGen:            "26FA8ABC-100A-6641-AB9E-341D9A58E2B8",
		SelloVal:          "2025A3ED1EEB6A054A3183C3DFA14F1D0AF24OLI",
		TipoDte:           "03",
		NombDte:           "COMPROBANTE DE CREDITO FISCAL",
		Documento:         &publicAPIDocumento{},
	}
	payload.Documento.Identificacion.NumeroControl = "DTE-03-S009P001-000000000000801"
	payload.Documento.Resumen.SubTotalVentas = floatPtr(80.97)
	payload.Documento.Resumen.SubTotal = floatPtr(80.97)
	payload.Documento.Resumen.TotalGravada = floatPtr(80.97)
	payload.Documento.Resumen.MontoTotalOperacion = floatPtr(91.5)
	payload.Documento.Resumen.TotalPagar = floatPtr(91.5)
	payload.Documento.Resumen.IvaPerci1 = floatPtr(0)
	payload.Documento.Resumen.IvaRete1 = floatPtr(0)
	payload.Documento.Resumen.ReteRenta = floatPtr(0)
	payload.Documento.Resumen.TotalNoGravado = floatPtr(0)
	payload.Documento.Resumen.Tributos = []publicAPITributo{{
		Codigo:      "20",
		Descripcion: "Impuesto del 13%",
		Valor:       floatPtr(10.53),
	}}

	result := mapPublicAPIResponse(payload, Result{})

	assertCCFFAmounts(t, result, ccffExpected{
		montoTotal:          "80.97",
		montoTotalOperacion: "91.5",
		ivaOperaciones:      "10.53",
		ivaPercibido:        "0",
		ivaRetenido:         "0",
		retencionRenta:      "0",
		totalNoAfectos:      "0",
		totalPagarOperacion: "91.5",
	})
}

func TestMapPublicAPIResponseReadsCreditoFiscalRealPayload467D60E7(t *testing.T) {
	payload := publicAPIResponse{
		EstadoDoc:         "Transmitido Satisfactoriamente",
		DescripcionEstado: "Documento Recibido",
		FechaEmi:          "2025-05-09",
		HoraEmi:           "17:41:15",
		FechaProcesado:    "2025-05-09 17:41:20",
		CodGen:            "467D60E7-2682-45FA-98F8-FFC4225CDC95",
		SelloVal:          "2025B23D4C66B55F4EACBE45C412D0161C54UIFH",
		TipoDte:           "03",
		NombDte:           "COMPROBANTE DE CREDITO FISCAL",
		Documento:         &publicAPIDocumento{},
	}
	payload.Documento.Identificacion.NumeroControl = "DTE-03-00000000-000000000000204"
	payload.Documento.Resumen.SubTotalVentas = floatPtr(61.95)
	payload.Documento.Resumen.SubTotal = floatPtr(61.95)
	payload.Documento.Resumen.TotalGravada = floatPtr(61.95)
	payload.Documento.Resumen.MontoTotalOperacion = floatPtr(70)
	payload.Documento.Resumen.TotalPagar = floatPtr(70)
	payload.Documento.Resumen.IvaPerci1 = floatPtr(0)
	payload.Documento.Resumen.IvaRete1 = floatPtr(0)
	payload.Documento.Resumen.ReteRenta = floatPtr(0)
	payload.Documento.Resumen.TotalNoGravado = floatPtr(0)
	payload.Documento.Resumen.Tributos = []publicAPITributo{{
		Codigo:      "20",
		Descripcion: "Impuesto al Valor Agregado 13%",
		Valor:       floatPtr(8.05),
	}}

	result := mapPublicAPIResponse(payload, Result{})

	assertCCFFAmounts(t, result, ccffExpected{
		montoTotal:          "61.95",
		montoTotalOperacion: "70",
		ivaOperaciones:      "8.05",
		ivaPercibido:        "0",
		ivaRetenido:         "0",
		retencionRenta:      "0",
		totalNoAfectos:      "0",
		totalPagarOperacion: "70",
	})
}

type ccffExpected struct {
	montoTotal          string
	montoTotalOperacion string
	ivaOperaciones      string
	ivaPercibido        string
	ivaRetenido         string
	retencionRenta      string
	totalNoAfectos      string
	totalPagarOperacion string
}

func assertCCFFAmounts(t *testing.T, result Result, want ccffExpected) {
	t.Helper()
	if result.TipoDteNorm != "COMPROBANTE DE CREDITO FISCAL" {
		t.Fatalf("TipoDteNorm = %q", result.TipoDteNorm)
	}
	if result.MontoTotal != want.montoTotal {
		t.Fatalf("MontoTotal = %q, want %q", result.MontoTotal, want.montoTotal)
	}
	if result.MontoTotalOperacion != want.montoTotalOperacion {
		t.Fatalf("MontoTotalOperacion = %q, want %q", result.MontoTotalOperacion, want.montoTotalOperacion)
	}
	if result.IvaOperaciones != want.ivaOperaciones {
		t.Fatalf("IvaOperaciones = %q, want %q", result.IvaOperaciones, want.ivaOperaciones)
	}
	if result.IvaPercibido != want.ivaPercibido {
		t.Fatalf("IvaPercibido = %q, want %q", result.IvaPercibido, want.ivaPercibido)
	}
	if result.IvaRetenido != want.ivaRetenido {
		t.Fatalf("IvaRetenido = %q, want %q", result.IvaRetenido, want.ivaRetenido)
	}
	if result.RetencionRenta != want.retencionRenta {
		t.Fatalf("RetencionRenta = %q, want %q", result.RetencionRenta, want.retencionRenta)
	}
	if result.TotalNoAfectos != want.totalNoAfectos {
		t.Fatalf("TotalNoAfectos = %q, want %q", result.TotalNoAfectos, want.totalNoAfectos)
	}
	if result.TotalPagarOperacion != want.totalPagarOperacion {
		t.Fatalf("TotalPagarOperacion = %q, want %q", result.TotalPagarOperacion, want.totalPagarOperacion)
	}
}

func TestMapPublicAPIResponseZeroIvaExemptInvoice(t *testing.T) {
	payload := publicAPIResponse{
		EstadoDoc: "Transmitido Satisfactoriamente",
		CodGen:    "TEST-COD",
		Documento: &publicAPIDocumento{},
	}
	payload.Documento.Resumen.SubTotalVentas = floatPtr(56.45)
	payload.Documento.Resumen.MontoTotalOperacion = floatPtr(56.45)
	payload.Documento.Resumen.TotalPagar = floatPtr(56.45)
	payload.Documento.Resumen.TotalGravada = floatPtr(0)
	payload.Documento.Resumen.TotalExenta = floatPtr(56.45)
	payload.Documento.Resumen.IvaPerci1 = floatPtr(0)
	payload.Documento.Resumen.IvaRete1 = floatPtr(0)
	payload.Documento.Resumen.ReteRenta = floatPtr(0)
	payload.Documento.Resumen.TotalNoGravado = floatPtr(0)

	result := mapPublicAPIResponse(payload, Result{})

	if result.IvaOperaciones != "" {
		t.Fatalf("IvaOperaciones = %q, want empty when totalIva is null", result.IvaOperaciones)
	}
	if result.IvaPercibido != "0" {
		t.Fatalf("IvaPercibido = %q, want 0 from API", result.IvaPercibido)
	}
	if result.TotalPagarOperacion != "56.45" {
		t.Fatalf("TotalPagarOperacion = %q, want 56.45", result.TotalPagarOperacion)
	}
}

func TestMapPublicAPIResponseNotFound(t *testing.T) {
	payload := publicAPIResponse{
		EstadoDoc:         "Error",
		DescripcionEstado: "no existen en nuestros registros",
		Action:            "ADVERTENCIA",
	}
	base := baseErrorResult("https://admin.factura.gob.sv/consultaPublica?ambiente=01&codGen=X&fechaEmi=2026-01-01", nil)
	result := mapPublicAPIResponse(payload, base)
	if result.OK {
		t.Fatal("expected not ok")
	}
	if result.Estado != "NO ENCONTRADO" {
		t.Fatalf("Estado = %q, want NO ENCONTRADO", result.Estado)
	}
}

func TestPublicAPIEnvPrefix(t *testing.T) {
	if publicAPIEnvPrefix("01") != "prod" {
		t.Fatal("ambiente 01 should use prod")
	}
	if publicAPIEnvPrefix("00") != "test" {
		t.Fatal("ambiente 00 should use test")
	}
}

func floatPtr(value float64) *float64 {
	return &value
}
