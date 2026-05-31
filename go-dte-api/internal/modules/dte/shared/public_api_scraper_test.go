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
