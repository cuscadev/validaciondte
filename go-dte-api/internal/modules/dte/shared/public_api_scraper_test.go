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
