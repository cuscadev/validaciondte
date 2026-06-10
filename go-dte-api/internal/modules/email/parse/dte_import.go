package parse

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var uuidRE = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

var allowedTipoDte = map[string]struct{}{
	"01": {}, "03": {}, "05": {}, "06": {}, "11": {}, "14": {},
}

var tipoDteLabels = map[string]string{
	"01": "Factura",
	"03": "Comprobante de Crédito Fiscal",
	"05": "Nota de Crédito",
	"06": "Nota de Débito",
	"11": "Factura de Exportación",
	"14": "Factura de Sujeto Excluido",
}

type RelatedDocumentRef struct {
	CodigoGeneracion string
	TipoDocumento    string
	FechaEmi         string
}

type ParsedDteImport struct {
	CodigoGeneracion string
	FecEmi           string
	TipoDte          string
	TipoDteLabel     string
	NumeroControl    string
	Ambiente         string
	SelloRecepcion   string
	EmisorNit        string
	EmisorNrc        string
	EmisorNombre     string
	ReceptorNit      string
	ReceptorNrc      string
	MontoTotal       float64
	IVA              float64
	RelatedDocuments []RelatedDocumentRef
}

func IsAllowedTipoDte(tipoDte string) bool {
	tipoDte = padTipo(tipoDte)
	_, ok := allowedTipoDte[tipoDte]
	return ok
}

func IsDateInRange(fechaYMD, dateFrom, dateTo string) bool {
	return fechaYMD >= dateFrom && fechaYMD <= dateTo
}

func ParseDteForImport(data []byte) *ParsedDteImport {
	text := string(data)
	var raw any
	if err := json.Unmarshal(data, &raw); err == nil {
		if parsed := ParseDteFromObject(raw); parsed != nil {
			return parsed
		}
	}

	codMatch := regexp.MustCompile(`"codigoGeneracion"\s*:\s*"([0-9A-Fa-f-]{36})"`).FindStringSubmatch(text)
	fechaMatch := regexp.MustCompile(`"(?:fecEmi|fechaEmi|fechaEmision)"\s*:\s*"(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})"`).FindStringSubmatch(text)
	tipoMatch := regexp.MustCompile(`"tipoDte"\s*:\s*"(\d{2})"`).FindStringSubmatch(text)
	if len(codMatch) > 1 && len(fechaMatch) > 1 {
		codigo := strings.ToUpper(codMatch[1])
		fecEmi := NormalizeDate(fechaMatch[1])
		tipoDte := padTipo("")
		if len(tipoMatch) > 1 {
			tipoDte = padTipo(tipoMatch[1])
		}
		if uuidRE.MatchString(codigo) && fecEmi != "" && tipoDte != "" {
			return &ParsedDteImport{
				CodigoGeneracion: codigo,
				FecEmi:           fecEmi,
				TipoDte:          tipoDte,
				TipoDteLabel:     labelForTipo(tipoDte),
				Ambiente:         "01",
			}
		}
	}
	return nil
}

func ParseDteFromObject(raw any) *ParsedDteImport {
	for _, item := range collectCandidates(raw) {
		dte := resolveDteItem(item)
		ident := extractIdentificacion(dte)
		codigo := strings.ToUpper(ident.Generacion)
		fecEmi := NormalizeDate(ident.FechaISO)
		tipoDte := padTipo(ident.TipoDte)

		if !uuidRE.MatchString(codigo) || fecEmi == "" || tipoDte == "" {
			continue
		}

		emisor := extractEmisor(dte)
		receptor := extractReceptor(dte)
		montos := extractResumenMontos(dte)
		identRecord := asRecord(dte["identificacion"])

		return &ParsedDteImport{
			CodigoGeneracion: codigo,
			FecEmi:           fecEmi,
			TipoDte:          tipoDte,
			TipoDteLabel:     labelForTipo(tipoDte),
			NumeroControl:    ident.NumeroControl,
			Ambiente:         firstNonEmpty(asString(identRecord["ambiente"]), "01"),
			SelloRecepcion:   extractSelloFromJSON(dte),
			EmisorNit:        emisor.Nit,
			EmisorNrc:        emisor.Nrc,
			EmisorNombre:     emisor.Nombre,
			ReceptorNit:      receptor.Nit,
			ReceptorNrc:      receptor.Nrc,
			MontoTotal:       firstNonZero(montos.TotalPagar, montos.MontoTotalOperacion),
			IVA:              montos.IVA,
			RelatedDocuments: extractRelatedDocuments(dte),
		}
	}
	return nil
}

func NormalizeDate(raw string) string {
	value := strings.TrimSpace(raw)
	if regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`).MatchString(value) {
		return value
	}
	if m := regexp.MustCompile(`^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$`).FindStringSubmatch(value); len(m) == 4 {
		return fmt.Sprintf("%s-%s-%s", m[3], m[2], m[1])
	}
	return ""
}

func padTipo(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if len(value) == 1 {
		return "0" + value
	}
	return value
}

func labelForTipo(tipo string) string {
	if label, ok := tipoDteLabels[tipo]; ok {
		return label
	}
	return fmt.Sprintf("DTE %s", tipo)
}

func collectCandidates(raw any) []map[string]any {
	switch v := raw.(type) {
	case nil:
		return nil
	case []any:
		out := make([]map[string]any, 0, len(v))
		for _, item := range v {
			if m, ok := item.(map[string]any); ok {
				out = append(out, m)
			}
		}
		return out
	case map[string]any:
		return []map[string]any{v}
	default:
		return nil
	}
}

func resolveDteItem(item map[string]any) map[string]any {
	wrappers := []map[string]any{
		item,
		asRecord(item["dte"]),
		asRecord(item["documento"]),
		asRecord(item["data"]),
	}
	for _, candidate := range wrappers {
		if len(asRecord(candidate["identificacion"])) > 0 {
			return candidate
		}
	}
	return item
}

func extractRelatedDocuments(dte map[string]any) []RelatedDocumentRef {
	keys := []string{"documentoRelacionado", "documentosRelacionados", "documentoRelacionados"}
	seen := map[string]struct{}{}
	var out []RelatedDocumentRef
	for _, key := range keys {
		for _, ref := range extractRelatedFromArray(dte[key]) {
			if _, ok := seen[ref.CodigoGeneracion]; ok {
				continue
			}
			seen[ref.CodigoGeneracion] = struct{}{}
			out = append(out, ref)
		}
	}
	return out
}

func extractRelatedFromArray(arr any) []RelatedDocumentRef {
	items, ok := arr.([]any)
	if !ok {
		return nil
	}
	var out []RelatedDocumentRef
	for _, entry := range items {
		row := asRecord(entry)
		codigo := strings.ToUpper(firstNonEmpty(
			asString(row["numeroDocumento"]),
			asString(row["codigoGeneracion"]),
			asString(row["codGen"]),
		))
		if !uuidRE.MatchString(codigo) {
			continue
		}
		out = append(out, RelatedDocumentRef{
			CodigoGeneracion: codigo,
			TipoDocumento:    asString(row["tipoDocumento"]),
			FechaEmi: NormalizeDate(firstNonEmpty(
				asString(row["fechaEmision"]),
				asString(row["fecEmi"]),
				asString(row["fechaGeneracion"]),
			)),
		})
	}
	return out
}

type identFields struct {
	Generacion    string
	NumeroControl string
	FechaISO      string
	TipoDte       string
}

type partyFields struct {
	Nit    string
	Nrc    string
	Nombre string
}

type montosFields struct {
	TotalPagar          float64
	MontoTotalOperacion float64
	IVA                 float64
}

func extractIdentificacion(obj map[string]any) identFields {
	ident := asRecord(obj["identificacion"])
	return identFields{
		Generacion:    asString(ident["codigoGeneracion"]),
		NumeroControl: asString(ident["numeroControl"]),
		FechaISO:      asString(ident["fecEmi"]),
		TipoDte:       asString(ident["tipoDte"]),
	}
}

func extractEmisor(obj map[string]any) partyFields {
	emisor := asRecord(obj["emisor"])
	return partyFields{
		Nit:    asString(emisor["nit"]),
		Nrc:    asString(emisor["nrc"]),
		Nombre: strings.ToUpper(asString(emisor["nombre"])),
	}
}

func extractReceptor(obj map[string]any) partyFields {
	receptor := asRecord(obj["receptor"])
	return partyFields{
		Nit: asString(receptor["nit"]),
		Nrc: asString(receptor["nrc"]),
	}
}

func extractResumenMontos(obj map[string]any) montosFields {
	resumen := asRecord(obj["resumen"])
	exenta := toNumber(resumen["totalExenta"])
	gravada := toNumber(resumen["totalGravada"])

	ivaTributo := 0.0
	if tributos, ok := resumen["tributos"].([]any); ok {
		for _, entry := range tributos {
			row := asRecord(entry)
			if asString(row["codigo"]) == "20" {
				ivaTributo = toNumber(row["valor"])
				break
			}
		}
	}

	ivaDesdeResumen := firstNonZero(
		toNumber(resumen["totalIva"]),
		toNumber(resumen["ivaPerci1"]),
		ivaTributo,
	)
	iva := ivaDesdeResumen
	if iva <= 0 {
		iva = round2(gravada * 0.13)
	}

	totalPagar := toNumber(resumen["totalPagar"])
	montoTotalOperacion := toNumber(firstNonNil(resumen["montoTotalOperacion"], resumen["subTotalVentas"], gravada+exenta))

	return montosFields{
		TotalPagar:          totalPagar,
		MontoTotalOperacion: montoTotalOperacion,
		IVA:                 iva,
	}
}

func extractSelloFromJSON(obj map[string]any) string {
	return firstNonEmpty(
		asString(obj["selloRecibido"]),
		asString(obj["selloRecepcion"]),
		asString(obj["SelloRecibido"]),
		asString(obj["SelloRecepcion"]),
		asString(asRecord(obj["respuestaHacienda"])["selloRecibido"]),
		asString(asRecord(obj["respuestaHacienda"])["selloRecepcion"]),
		asString(asRecord(obj["responseHacienda"])["selloRecibido"]),
		asString(asRecord(obj["responseHacienda"])["selloRecepcion"]),
		asString(asRecord(obj["responseMH"])["selloRecibido"]),
		asString(asRecord(obj["responseMH"])["selloRecepcion"]),
	)
}

func asRecord(value any) map[string]any {
	if m, ok := value.(map[string]any); ok {
		return m
	}
	return map[string]any{}
}

func asString(value any) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func firstNonZero(values ...float64) float64 {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

func firstNonNil(values ...any) any {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func toNumber(value any) float64 {
	switch v := value.(type) {
	case float64:
		if v == v {
			return v
		}
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case json.Number:
		f, _ := v.Float64()
		return f
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
		if err == nil {
			return f
		}
	}
	return 0
}

func round2(value float64) float64 {
	return float64(int(value*100+0.5)) / 100
}
