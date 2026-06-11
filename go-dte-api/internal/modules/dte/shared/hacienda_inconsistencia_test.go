package shared

import "testing"

func TestHaciendaInconsistenciaCatalogSRO(t *testing.T) {
	group, ok := lookupInconsistenciaGroup("SRO")
	if !ok {
		t.Fatal("SRO group not found")
	}
	if group.Descripcion != "Satisfactorio con Observacion" {
		t.Fatalf("descripcion = %q", group.Descripcion)
	}
	want := []inconsistenciaEntry{
		{Codigo: "SRO01", Descripcion: "DTE no contiene sello de recepción", Estado: "SRO"},
		{Codigo: "SRO02", Descripcion: "Ajuste al documento no autorizado por el Receptor", Estado: "SRO"},
		{Codigo: "SRO03", Descripcion: "Diferencia en monto de la operación", Estado: "SRO"},
		{Codigo: "SRO04", Descripcion: "Diferencia en fecha/hora de DTE ", Estado: "SRO"},
		{Codigo: "SRO05", Descripcion: "DTE de operación inexistente", Estado: "SRO"},
		{Codigo: "SRO06", Descripcion: "Diferencia en datos de identificación del DTE", Estado: "SRO"},
		{Codigo: "SRO07", Descripcion: "Otro", Estado: "SRO"},
	}
	if len(group.Inconsistencias) != len(want) {
		t.Fatalf("len = %d, want %d", len(group.Inconsistencias), len(want))
	}
	for i, entry := range want {
		got := group.Inconsistencias[i]
		if got != entry {
			t.Fatalf("entry[%d] = %+v, want %+v", i, got, entry)
		}
	}
}

func TestResolveInconsistenciaCodigoSROCatalog(t *testing.T) {
	cases := []struct {
		obs  string
		code string
	}{
		{"DTE no contiene sello de recepción", "SRO01"},
		{"Ajuste al documento no autorizado por el Receptor", "SRO02"},
		{"Diferencia en monto de la operación", "SRO03"},
		{"[identificacion.fecEmi] DIFIERE DE LA FECHA DE ENVIO", "SRO04"},
		{"DTE de operación inexistente", "SRO05"},
		{"Diferencia en datos de identificación del DTE", "SRO06"},
		{"Observación no clasificada", "SRO07"},
	}
	for _, tc := range cases {
		code, _ := resolveInconsistenciaCodigo("SRO", tc.obs)
		if code != tc.code {
			t.Fatalf("obs %q => codigo %q, want %q", tc.obs, code, tc.code)
		}
	}
}

func TestResolveEstadoDocIncDescripcionSR(t *testing.T) {
	desc := resolveEstadoDocIncDescripcion("SR")
	if desc != "Satisfactorio" {
		t.Fatalf("descripcion = %q, want Satisfactorio", desc)
	}
}

func TestResolveInconsistenciaCodigoSROFecha(t *testing.T) {
	code, desc := resolveInconsistenciaCodigo(
		"SRO",
		"[identificacion.fecEmi] DIFIERE DE LA FECHA DE ENVIO",
	)
	if code != "SRO04" {
		t.Fatalf("codigo = %q, want SRO04", code)
	}
	if desc != "Diferencia en fecha/hora de DTE" {
		t.Fatalf("descripcion = %q", desc)
	}
}

func TestResolveInconsistenciaCodigoSRMonto(t *testing.T) {
	code, _ := resolveInconsistenciaCodigo("SR", "Diferencia en monto de la operación")
	if code != "SR02" {
		t.Fatalf("codigo = %q, want SR02", code)
	}
}

func TestMapPublicAPIResponseEstadoDocIncSR(t *testing.T) {
	payload := publicAPIResponse{
		EstadoDoc:         "Transmitido Satisfactoriamente",
		EstadoDocInc:      "SR",
		ReporteInc:        false,
		DescripcionEstado: "Documento Recibido",
		CodGen:            "26FA8ABC-100A-6641-AB9E-341D9A58E2B8",
		Action:            "OK",
		TipoDte:           "03",
		NombDte:           "COMPROBANTE DE CREDITO FISCAL",
		Documento:         &publicAPIDocumento{},
	}
	result := mapPublicAPIResponse(payload, Result{})
	if result.EstadoDocInc != "SR" {
		t.Fatalf("EstadoDocInc = %q, want SR", result.EstadoDocInc)
	}
	if result.EstadoDocIncDescripcion != "Satisfactorio" {
		t.Fatalf("EstadoDocIncDescripcion = %q, want Satisfactorio", result.EstadoDocIncDescripcion)
	}
	if result.InconsistenciasCodigos != "" {
		t.Fatalf("InconsistenciasCodigos = %q, want empty", result.InconsistenciasCodigos)
	}
}

func TestMapPublicAPIResponseComprobanteRetencionSRO0A4DADB3(t *testing.T) {
	payload := publicAPIResponse{
		EstadoDoc:         "Transmitido Satisfactoriamente",
		EstadoDocInc:      "SRO",
		ReporteInc:        false,
		DescripcionEstado: "Documento Recibido con Observaciones",
		FechaEmi:          "2026-05-21",
		HoraEmi:           "12:00:00",
		FechaProcesado:    "2026-05-29 10:23:40",
		CodGen:            "0A4DADB3-3D73-40D8-A10A-98FB6ADDFFB2",
		SelloVal:          "2026E01BC8AF6875462C8E10CCD1EBCAD79CUXMB",
		Action:            "OK",
		TipoDte:           "07",
		NombDte:           "COMPROBANTE DE RETENCION",
		Observaciones: []string{
			"[identificacion.fecEmi] DIFIERE DE LA FECHA DE ENVIO",
		},
		Documento: &publicAPIDocumento{},
	}
	payload.Documento.Identificacion.NumeroControl = "DTE-07-M001P001-000000000012360"
	payload.Documento.Resumen.TotalSujetoRetencion = floatPtr(114)
	payload.Documento.Resumen.TotalIVAretenido = floatPtr(1.14)

	result := mapPublicAPIResponse(payload, Result{})

	if result.TipoDteNorm != "COMPROBANTE DE RETENCION" {
		t.Fatalf("TipoDteNorm = %q", result.TipoDteNorm)
	}
	if result.EstadoDocInc != "SRO" {
		t.Fatalf("EstadoDocInc = %q, want SRO", result.EstadoDocInc)
	}
	if result.EstadoDocIncDescripcion != "Satisfactorio con Observacion" {
		t.Fatalf("EstadoDocIncDescripcion = %q", result.EstadoDocIncDescripcion)
	}
	if result.InconsistenciasCodigos != "SRO04" {
		t.Fatalf("InconsistenciasCodigos = %q, want SRO04", result.InconsistenciasCodigos)
	}
	if result.MontoTotalOperacion != "114" {
		t.Fatalf("MontoTotalOperacion = %q, want 114", result.MontoTotalOperacion)
	}
	if result.IvaRetenido != "1.14" {
		t.Fatalf("IvaRetenido = %q, want 1.14", result.IvaRetenido)
	}
	if result.TotalPagarOperacion != "1.14" {
		t.Fatalf("TotalPagarOperacion = %q, want 1.14", result.TotalPagarOperacion)
	}
}

func TestMapPublicAPIResponseEstadoDocIncSRO(t *testing.T) {
	payload := publicAPIResponse{
		EstadoDoc:         "Transmitido Satisfactoriamente",
		EstadoDocInc:      "SRO",
		ReporteInc:        true,
		DescripcionEstado: "Documento Recibido",
		Observaciones: []string{
			"[identificacion.fecEmi] DIFIERE DE LA FECHA DE ENVIO",
		},
		Documento: &publicAPIDocumento{},
	}
	result := mapPublicAPIResponse(payload, Result{})
	if result.EstadoDocInc != "SRO" {
		t.Fatalf("EstadoDocInc = %q, want SRO", result.EstadoDocInc)
	}
	if result.InconsistenciasCodigos != "SRO04" {
		t.Fatalf("InconsistenciasCodigos = %q, want SRO04", result.InconsistenciasCodigos)
	}
	if len(result.Observaciones) != 1 {
		t.Fatalf("observaciones len = %d, want 1", len(result.Observaciones))
	}
	if result.Observaciones[0].CodigoInconsistencia != "SRO04" {
		t.Fatalf("CodigoInconsistencia = %q, want SRO04", result.Observaciones[0].CodigoInconsistencia)
	}
	wantText := "1. SRO04: Diferencia en fecha/hora de DTE - [identificacion.fecEmi] DIFIERE DE LA FECHA DE ENVIO"
	if result.ObservacionesTexto != wantText {
		t.Fatalf("ObservacionesTexto = %q, want %q", result.ObservacionesTexto, wantText)
	}
}
