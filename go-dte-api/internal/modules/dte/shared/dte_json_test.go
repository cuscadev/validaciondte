package shared

import (
	"encoding/base64"
	"encoding/json"
	"testing"
)

func TestResultLookupKeyNormalizesDate(t *testing.T) {
	key := ResultLookupKey("12345678-1234-1234-1234-123456789abc", "15/01/2026")
	want := "12345678-1234-1234-1234-123456789ABC|2026-01-15"
	if key != want {
		t.Fatalf("got %q, want %q", key, want)
	}
}

func TestExtractDTEJSONFields(t *testing.T) {
	item := map[string]any{
		"identificacion": map[string]any{
			"codigoGeneracion": "12345678-1234-1234-1234-123456789ABC",
			"fecEmi":           "2026-01-15",
			"numeroControl":    "DTE-01-001-00000001",
			"tipoDte":          "01",
			"ambiente":         "01",
		},
		"resumen": map[string]any{
			"montoTotalOperacion": 100.0,
			"totalPagar":          113.0,
			"totalIva":            13.0,
		},
		"selloRecibido": "SELLO-123",
		"emisor": map[string]any{
			"nit":    "0614-010101-101-1",
			"nombre": "EMPRESA SA",
		},
		"receptor": map[string]any{
			"nit":    "0614-020202-202-2",
			"nombre": "CLIENTE SA",
		},
	}

	got := ExtractDTEJSONFields(item)
	if got.NumeroControl != "DTE-01-001-00000001" {
		t.Fatalf("NumeroControl = %q", got.NumeroControl)
	}
	if got.SelloRecepcion != "SELLO-123" {
		t.Fatalf("SelloRecepcion = %q", got.SelloRecepcion)
	}
	if got.MontoTotal != "100.00" {
		t.Fatalf("MontoTotal = %q", got.MontoTotal)
	}
	if got.TotalPagarOperacion != "113.00" {
		t.Fatalf("TotalPagarOperacion = %q", got.TotalPagarOperacion)
	}
	if got.IvaOperaciones != "13.00" {
		t.Fatalf("IvaOperaciones = %q", got.IvaOperaciones)
	}
	if got.EmisorNombre != "EMPRESA SA" {
		t.Fatalf("EmisorNombre = %q", got.EmisorNombre)
	}
}

func TestMergeJSONIntoResultFillsEmptyScrapeFields(t *testing.T) {
	scrape := Result{
		Estado:            "EMITIDO",
		DescripcionEstado: "Transmitido satisfactoriamente",
		CodGen:            "12345678-1234-1234-1234-123456789ABC",
		FechaEmi:          "2026-01-15",
	}
	jsonFields := Result{
		NumeroControl:       "DTE-01-001-00000001",
		SelloRecepcion:      "SELLO-123",
		MontoTotal:          "100.00",
		TotalPagarOperacion: "113.00",
		IvaOperaciones:      "13.00",
		EmisorNombre:        "EMPRESA SA",
	}

	MergeJSONIntoResult(&scrape, jsonFields)

	if scrape.NumeroControl != "DTE-01-001-00000001" {
		t.Fatalf("NumeroControl = %q", scrape.NumeroControl)
	}
	if scrape.SelloRecepcion != "SELLO-123" {
		t.Fatalf("SelloRecepcion = %q", scrape.SelloRecepcion)
	}
	if scrape.MontoTotal != "100.00" {
		t.Fatalf("MontoTotal = %q", scrape.MontoTotal)
	}
	if scrape.EmisorNombre != "EMPRESA SA" {
		t.Fatalf("EmisorNombre = %q", scrape.EmisorNombre)
	}
	if scrape.Estado != "EMITIDO" {
		t.Fatalf("Estado should remain from scrape, got %q", scrape.Estado)
	}
}

func TestMergeJSONIntoResultDoesNotOverwriteScrapeValues(t *testing.T) {
	scrape := Result{
		SelloRecepcion: "SELLO-SCRAPE",
		MontoTotal:     "200.00",
	}
	jsonFields := Result{
		SelloRecepcion: "SELLO-JSON",
		MontoTotal:     "100.00",
	}

	MergeJSONIntoResult(&scrape, jsonFields)

	if scrape.SelloRecepcion != "SELLO-SCRAPE" {
		t.Fatalf("SelloRecepcion = %q", scrape.SelloRecepcion)
	}
	if scrape.MontoTotal != "200.00" {
		t.Fatalf("MontoTotal = %q", scrape.MontoTotal)
	}
}

func buildTestJWS(payload map[string]any) string {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none"}`))
	body := base64.RawURLEncoding.EncodeToString(payloadJSON)
	return header + "." + body + ".signature"
}

func TestExtractConsultaFieldsSignedBundle(t *testing.T) {
	item := map[string]any{
		"identificacion": map[string]any{
			"codigoGeneracion": "95EA92A3-E0E5-4027-ABF0-1BF8602BE6C1",
			"fecEmi":           "2023-07-29",
			"tipoDte":          "01",
		},
		"respuestaHacienda": map[string]any{
			"codigoGeneracion": "95EA92A3-E0E5-4027-ABF0-1BF8602BE6C1",
			"selloRecibido":    "202330CAA018B75E437BB3679E45D39AC231FNSB",
		},
		"emisor": map[string]any{"nombre": "ALMACENES VIDRI S.A. DE C.V."},
		"resumen": map[string]any{
			"montoTotalOperacion": 8.85,
			"totalPagar":          8.85,
		},
	}

	codGen, fechaYMD, ok := ExtractConsultaFields(item)
	if !ok {
		t.Fatal("expected signed bundle to parse")
	}
	if codGen != "95EA92A3-E0E5-4027-ABF0-1BF8602BE6C1" {
		t.Fatalf("codGen = %q", codGen)
	}
	if fechaYMD != "2023-07-29" {
		t.Fatalf("fechaYMD = %q", fechaYMD)
	}

	got := ExtractDTEJSONFields(item)
	if got.SelloRecepcion != "202330CAA018B75E437BB3679E45D39AC231FNSB" {
		t.Fatalf("SelloRecepcion = %q", got.SelloRecepcion)
	}
	if got.EmisorNombre != "ALMACENES VIDRI S.A. DE C.V." {
		t.Fatalf("EmisorNombre = %q", got.EmisorNombre)
	}
}

func TestExtractConsultaFieldsFechaEmiAlternative(t *testing.T) {
	item := map[string]any{
		"identificacion": map[string]any{
			"codigoGeneracion": "12345678-1234-1234-1234-123456789ABC",
			"fechaEmi":         "2026-01-15",
		},
	}

	_, fechaYMD, ok := ExtractConsultaFields(item)
	if !ok {
		t.Fatal("expected fechaEmi fallback to parse")
	}
	if fechaYMD != "2026-01-15" {
		t.Fatalf("fechaYMD = %q", fechaYMD)
	}
}

func TestDecodeJWSPayloadOnlyToken(t *testing.T) {
	jws := buildTestJWS(map[string]any{
		"identificacion": map[string]any{
			"codigoGeneracion": "95EA92A3-E0E5-4027-ABF0-1BF8602BE6C1",
			"fecEmi":           "2023-07-29",
		},
	})

	codGen, fechaYMD, ok := ExtractConsultaFields(map[string]any{"firma": jws})
	if !ok {
		payload, decoded := DecodeJWSPayload(jws)
		if !decoded {
			t.Fatal("expected JWS payload decode")
		}
		codGen, fechaYMD, ok = ExtractConsultaFields(payload)
	}
	if !ok {
		t.Fatal("expected JWS-only token to parse")
	}
	if codGen != "95EA92A3-E0E5-4027-ABF0-1BF8602BE6C1" {
		t.Fatalf("codGen = %q", codGen)
	}
	if fechaYMD != "2023-07-29" {
		t.Fatalf("fechaYMD = %q", fechaYMD)
	}
}

func TestParseJSONFileItemsBrokenJSONUsesRegex(t *testing.T) {
	broken := []byte(`{
  "identificacion": {
    "codigoGeneracion": "95EA92A3-E0E5-4027-ABF0-1BF8602BE6C1",
    "fecEmi": "2023-07-29"
  },
  "firma": "broken`)

	items := ParseJSONFileItems(broken)
	if len(items) == 0 {
		t.Fatal("expected regex fallback item")
	}

	codGen, fechaYMD, ok := ExtractConsultaFields(items[0])
	if !ok {
		t.Fatal("expected regex-rescued fields")
	}
	if codGen != "95EA92A3-E0E5-4027-ABF0-1BF8602BE6C1" {
		t.Fatalf("codGen = %q", codGen)
	}
	if fechaYMD != "2023-07-29" {
		t.Fatalf("fechaYMD = %q", fechaYMD)
	}
}

func TestParseJSONFileItemsJWSTokenFile(t *testing.T) {
	jws := buildTestJWS(map[string]any{
		"identificacion": map[string]any{
			"codigoGeneracion": "12345678-1234-1234-1234-123456789ABC",
			"fecEmi":           "2026-01-15",
		},
	})

	items := ParseJSONFileItems([]byte(jws))
	if len(items) == 0 {
		t.Fatal("expected JWS file parse")
	}

	codGen, fechaYMD, ok := ExtractConsultaFields(items[0])
	if !ok || codGen != "12345678-1234-1234-1234-123456789ABC" || fechaYMD != "2026-01-15" {
		t.Fatalf("got codGen=%q fecha=%q ok=%v", codGen, fechaYMD, ok)
	}
}

func TestClassifyJSONFileParseError(t *testing.T) {
	if msg := ClassifyJSONFileParseError([]byte(""), nil, 0); msg != jsonParseErrInvalid {
		t.Fatalf("empty file msg = %q", msg)
	}

	items := []map[string]any{{"foo": "bar"}}
	if msg := ClassifyJSONFileParseError([]byte(`{"foo":"bar"}`), items, 0); msg != jsonParseErrNoFields {
		t.Fatalf("no fields msg = %q", msg)
	}

	jws := buildTestJWS(map[string]any{"identificacion": map[string]any{"codigoGeneracion": "bad", "fecEmi": "x"}})
	jwsData := []byte(jws)
	jwsItems := ParseJSONFileItems(jwsData)
	if msg := ClassifyJSONFileParseError(jwsData, jwsItems, 0); msg != jsonParseErrNoFields {
		t.Fatalf("invalid jws payload msg = %q", msg)
	}
}
