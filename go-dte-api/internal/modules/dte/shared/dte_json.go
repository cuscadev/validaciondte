package shared

import (
	"bufio"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

var (
	uuidInTextRegex   = regexp.MustCompile(`(?i)"codigoGeneracion"\s*:\s*"([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})"`)
	fecEmiInTextRegex = regexp.MustCompile(`(?i)"(?:fecEmi|fechaEmi|fechaEmision)"\s*:\s*"(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})"`)
	jwsTokenRegex     = regexp.MustCompile(`(?m)^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$`)
)

var dteWrapperKeys = []string{"dte", "documento", "dteJson", "json", "data"}

const jsonParseErrInvalid = "JSON invalido o ilegible."
const jsonParseErrNoFields = "No se encontraron identificacion.codigoGeneracion / fecEmi (o equivalentes) validos."
const jsonParseErrJWSOnly = "No se pudo extraer identificacion del JSON ni de la firma."

func StripUTF8BOM(data []byte) []byte {
	return bytesTrimPrefix(data, []byte{0xEF, 0xBB, 0xBF})
}

func bytesTrimPrefix(data, prefix []byte) []byte {
	if len(data) >= len(prefix) && string(data[:len(prefix)]) == string(prefix) {
		return data[len(prefix):]
	}
	return data
}

func ParseJSONFileItems(data []byte) []map[string]any {
	data = StripUTF8BOM(data)
	text := string(data)

	var raw any
	if err := json.Unmarshal(data, &raw); err == nil {
		return dedupeMapObjects(CollectDTEObjects(raw))
	}

	out := []map[string]any{}
	scanner := bufio.NewScanner(strings.NewReader(text))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var obj map[string]any
		if err := json.Unmarshal([]byte(line), &obj); err == nil {
			out = append(out, dedupeMapObjects(CollectDTEObjects(obj))...)
		}
	}
	if len(out) > 0 {
		return dedupeMapObjects(out)
	}

	for _, obj := range extractJWSPayloadObjects(text) {
		out = append(out, obj)
	}
	if len(out) > 0 {
		return dedupeMapObjects(out)
	}

	trimmed := strings.TrimSpace(text)
	if payload, ok := DecodeJWSPayload(trimmed); ok {
		return dedupeMapObjects(CollectDTEObjects(payload))
	}

	if codGen, fechaYMD, ok := RegexExtractConsultaFields(data); ok {
		return []map[string]any{syntheticDTEItem(codGen, fechaYMD)}
	}

	return nil
}

func ClassifyJSONFileParseError(data []byte, items []map[string]any, extractedCount int) string {
	if extractedCount > 0 {
		return ""
	}

	trimmed := strings.TrimSpace(string(StripUTF8BOM(data)))
	if trimmed == "" {
		return jsonParseErrInvalid
	}

	if looksLikeJWSToken(trimmed) {
		if _, ok := DecodeJWSPayload(trimmed); !ok {
			return jsonParseErrJWSOnly
		}
	}

	if len(items) > 0 {
		return jsonParseErrNoFields
	}

	if _, _, ok := RegexExtractConsultaFields(data); ok {
		return jsonParseErrNoFields
	}

	if strings.Contains(trimmed, "identificacion") || strings.Contains(trimmed, "codigoGeneracion") {
		return jsonParseErrNoFields
	}

	return jsonParseErrInvalid
}

func CollectDTEObjects(raw any) []map[string]any {
	out := []map[string]any{}
	collectDTEObjects(raw, &out)
	return out
}

func collectDTEObjects(raw any, out *[]map[string]any) {
	switch typed := raw.(type) {
	case []any:
		for _, item := range typed {
			collectDTEObjects(item, out)
		}
	case map[string]any:
		if looksLikeDTEObject(typed) {
			*out = append(*out, typed)
		}
		for _, value := range typed {
			collectDTEObjects(value, out)
		}
	case string:
		trimmed := strings.TrimSpace(typed)
		if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") {
			var nested any
			if err := json.Unmarshal([]byte(trimmed), &nested); err == nil {
				collectDTEObjects(nested, out)
			}
		}
	}
}

func looksLikeDTEObject(obj map[string]any) bool {
	if _, ok := obj["identificacion"]; ok {
		return true
	}
	for _, key := range dteWrapperKeys {
		if nested, ok := obj[key].(map[string]any); ok {
			if _, hasIdent := nested["identificacion"]; hasIdent {
				return true
			}
		}
	}
	if _, ok := obj["emisor"]; ok {
		if _, ok := obj["resumen"]; ok {
			return true
		}
	}
	return false
}

func ResolveDTEItem(item map[string]any) map[string]any {
	if item == nil {
		return map[string]any{}
	}
	if _, ok := item["identificacion"]; ok {
		return item
	}
	for _, key := range dteWrapperKeys {
		if nested, ok := item[key].(map[string]any); ok {
			if _, hasIdent := nested["identificacion"]; hasIdent {
				return nested
			}
		}
	}
	if payload, ok := DecodeJWSPayload(jsonAsString(item["firma"])); ok {
		if resolved := ResolveDTEItem(payload); len(resolved) > 0 {
			merged := copyMapShallow(item)
			for key, value := range resolved {
				merged[key] = value
			}
			return merged
		}
	}
	return item
}

func ExtractConsultaFields(item map[string]any) (codGen, fechaYMD string, ok bool) {
	resolved := ResolveDTEItem(item)

	candidates := []map[string]any{resolved, item}
	for _, key := range dteWrapperKeys {
		if nested, isMap := item[key].(map[string]any); isMap {
			candidates = append(candidates, nested)
		}
	}
	if payload, decoded := DecodeJWSPayload(jsonAsString(item["firma"])); decoded {
		candidates = append(candidates, payload, ResolveDTEItem(payload))
	}

	respuesta := jsonAsMap(item["respuestaHacienda"])
	respCodGen := strings.ToUpper(strings.TrimSpace(jsonAsString(respuesta["codigoGeneracion"])))

	for _, candidate := range candidates {
		ident := jsonAsMap(candidate["identificacion"])
		codGen = strings.ToUpper(strings.TrimSpace(jsonAsString(ident["codigoGeneracion"])))
		if !IsUUID(codGen) && IsUUID(respCodGen) {
			codGen = respCodGen
		}
		fechaYMD = extractIdentFechaYMD(ident)
		if IsUUID(codGen) && fechaYMD != "" {
			return codGen, fechaYMD, true
		}
	}

	if IsUUID(respCodGen) {
		for _, candidate := range candidates {
			ident := jsonAsMap(candidate["identificacion"])
			fechaYMD = extractIdentFechaYMD(ident)
			if fechaYMD != "" {
				return respCodGen, fechaYMD, true
			}
		}
	}

	return "", "", false
}

func extractIdentFechaYMD(ident map[string]any) string {
	for _, key := range []string{"fecEmi", "fechaEmi", "fechaEmision"} {
		if fechaYMD := NormalizeJSONDate(jsonAsString(ident[key])); fechaYMD != "" {
			return fechaYMD
		}
	}
	return ""
}

func DecodeJWSPayload(jws string) (map[string]any, bool) {
	jws = strings.TrimSpace(jws)
	parts := strings.Split(jws, ".")
	if len(parts) < 2 {
		return nil, false
	}

	payloadPart := parts[1]
	decoded, err := base64.RawURLEncoding.DecodeString(payloadPart)
	if err != nil {
		decoded, err = base64.URLEncoding.DecodeString(payloadPart)
	}
	if err != nil {
		padded := payloadPart + strings.Repeat("=", (4-len(payloadPart)%4)%4)
		decoded, err = base64.URLEncoding.DecodeString(padded)
	}
	if err != nil {
		return nil, false
	}

	var payload map[string]any
	if err := json.Unmarshal(decoded, &payload); err != nil {
		return nil, false
	}
	return payload, true
}

func RegexExtractConsultaFields(data []byte) (codGen, fechaYMD string, ok bool) {
	text := string(data)
	codMatch := uuidInTextRegex.FindStringSubmatch(text)
	if len(codMatch) < 2 {
		return "", "", false
	}
	codGen = strings.ToUpper(strings.TrimSpace(codMatch[1]))
	if !IsUUID(codGen) {
		return "", "", false
	}

	fechaMatch := fecEmiInTextRegex.FindStringSubmatch(text)
	if len(fechaMatch) < 2 {
		return "", "", false
	}
	fechaYMD = NormalizeJSONDate(fechaMatch[1])
	if fechaYMD == "" {
		return "", "", false
	}
	return codGen, fechaYMD, true
}

func extractJWSPayloadObjects(text string) []map[string]any {
	out := []map[string]any{}
	firmaRegex := regexp.MustCompile(`(?i)"firma"\s*:\s*"([^"]+)"`)
	for _, match := range firmaRegex.FindAllStringSubmatch(text, -1) {
		if len(match) < 2 {
			continue
		}
		if payload, ok := DecodeJWSPayload(match[1]); ok {
			out = append(out, payload)
		}
	}
	return out
}

func looksLikeJWSToken(text string) bool {
	return jwsTokenRegex.MatchString(strings.TrimSpace(text))
}

func syntheticDTEItem(codGen, fechaYMD string) map[string]any {
	return map[string]any{
		"identificacion": map[string]any{
			"codigoGeneracion": codGen,
			"fecEmi":           fechaYMD,
		},
	}
}

func dedupeMapObjects(items []map[string]any) []map[string]any {
	seen := map[string]bool{}
	out := make([]map[string]any, 0, len(items))
	for _, item := range items {
		codGen, fechaYMD, ok := ExtractConsultaFields(item)
		if !ok {
			key := fmt.Sprintf("obj:%p", item)
			if seen[key] {
				continue
			}
			seen[key] = true
			out = append(out, item)
			continue
		}
		key := ResultLookupKey(codGen, fechaYMD)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, item)
	}
	return out
}

func copyMapShallow(src map[string]any) map[string]any {
	dst := make(map[string]any, len(src))
	for key, value := range src {
		dst[key] = value
	}
	return dst
}

func ResultLookupKey(codGen, fecha string) string {
	cod := strings.ToUpper(strings.TrimSpace(codGen))
	fechaNorm := NormalizarFecha(strings.TrimSpace(fecha))
	if len(fechaNorm) >= 10 {
		fechaNorm = fechaNorm[:10]
	}
	return cod + "|" + fechaNorm
}

func ExtractDTEJSONFields(item map[string]any) Result {
	item = ResolveDTEItem(item)
	ident := jsonAsMap(item["identificacion"])
	emisor := jsonAsMap(item["emisor"])
	receptor := jsonAsMap(item["receptor"])
	direccion := jsonAsMap(receptor["direccion"])
	resumen := jsonAsMap(item["resumen"])

	codGen := strings.ToUpper(strings.TrimSpace(jsonAsString(ident["codigoGeneracion"])))
	fechaYMD := extractIdentFechaYMD(ident)
	tipoDte := jsonAsString(ident["tipoDte"])

	result := Result{
		CodGen:           codGen,
		CodigoGeneracion: codGen,
		FechaEmi:         fechaYMD,
		Ambiente:         jsonAsString(ident["ambiente"]),
		NumeroControl:    jsonAsString(ident["numeroControl"]),
		TipoDte:          tipoDte,
		TipoDteNorm:      NormalizarTipoDte(tipoDte),
		SelloRecepcion:   extractSelloFromJSON(item),
		MontoTotal:          extractMontoTotalFromResumen(resumen),
		MontoTotalOperacion: jsonAsString(resumen["montoTotalOperacion"]),
		IvaOperaciones:      extractIVAFromResumen(resumen),
		IvaPercibido:     firstNonEmpty(jsonAsString(resumen["ivaPerci1"]), jsonAsString(resumen["ivaPercibido"])),
		IvaRetenido:      firstNonEmpty(jsonAsString(resumen["ivaRete1"]), jsonAsString(resumen["ivaRetenido"])),
		RetencionRenta:   jsonAsString(resumen["reteRenta"]),
		TotalNoAfectos: firstNonEmpty(
			jsonAsString(resumen["totalNoGravado"]),
			jsonAsString(resumen["totalNoSuj"]),
			jsonAsString(resumen["totalExenta"]),
		),
		TotalPagarOperacion: jsonAsString(resumen["totalPagar"]),
		OtrosTributos:       extractOtrosTributos(resumen),
		TributosPorCodigo:   extractTributosPorCodigoFromResumen(resumen),

		EmisorNit:             jsonAsString(emisor["nit"]),
		EmisorNrc:             jsonAsString(emisor["nrc"]),
		EmisorNombre:          jsonAsString(emisor["nombre"]),
		EmisorCodActividad:    jsonAsString(emisor["codActividad"]),
		EmisorDescActividad:   jsonAsString(emisor["descActividad"]),
		EmisorNombreComercial: jsonAsString(emisor["nombreComercial"]),
		EmisorTelefono:        jsonAsString(emisor["telefono"]),
		EmisorCorreo:          jsonAsString(emisor["correo"]),

		ReceptorNit:             jsonAsString(receptor["nit"]),
		ReceptorNrc:             jsonAsString(receptor["nrc"]),
		ReceptorNombre:          jsonAsString(receptor["nombre"]),
		ReceptorCodActividad:    jsonAsString(receptor["codActividad"]),
		ReceptorDescActividad:   jsonAsString(receptor["descActividad"]),
		ReceptorDepartamento:    jsonAsString(direccion["departamento"]),
		ReceptorMunicipio:       jsonAsString(direccion["municipio"]),
		ReceptorComplemento:     jsonAsString(direccion["complemento"]),
		ReceptorTelefono:        jsonAsString(receptor["telefono"]),
		ReceptorCorreo:          jsonAsString(receptor["correo"]),
		ReceptorNombreComercial: jsonAsString(receptor["nombreComercial"]),
	}

	return result
}

func MergeJSONIntoResult(dst *Result, src Result) {
	if dst == nil {
		return
	}

	fillIfEmpty(&dst.CodGen, src.CodGen)
	fillIfEmpty(&dst.CodigoGeneracion, firstNonEmpty(src.CodigoGeneracion, src.CodGen))
	fillIfEmpty(&dst.FechaEmi, src.FechaEmi)
	fillIfEmpty(&dst.Ambiente, src.Ambiente)
	fillIfEmpty(&dst.NumeroControl, src.NumeroControl)
	fillIfEmpty(&dst.TipoDte, src.TipoDte)
	if dst.TipoDteNorm == "" || dst.TipoDteNorm == "SIN_TIPO" {
		if src.TipoDteNorm != "" && src.TipoDteNorm != "SIN_TIPO" {
			dst.TipoDteNorm = src.TipoDteNorm
		} else if strings.TrimSpace(dst.TipoDte) != "" {
			dst.TipoDteNorm = NormalizarTipoDte(dst.TipoDte)
		}
	}
	fillIfEmpty(&dst.SelloRecepcion, src.SelloRecepcion)
	fillIfEmpty(&dst.MontoTotal, src.MontoTotal)
	fillIfEmpty(&dst.MontoTotalOperacion, src.MontoTotalOperacion)
	fillIfEmpty(&dst.IvaOperaciones, src.IvaOperaciones)
	fillIfEmpty(&dst.IvaPercibido, src.IvaPercibido)
	fillIfEmpty(&dst.IvaRetenido, src.IvaRetenido)
	fillIfEmpty(&dst.RetencionRenta, src.RetencionRenta)
	fillIfEmpty(&dst.TotalNoAfectos, src.TotalNoAfectos)
	fillIfEmpty(&dst.TotalPagarOperacion, src.TotalPagarOperacion)
	fillIfEmpty(&dst.OtrosTributos, src.OtrosTributos)
	mergeTributosPorCodigo(dst, src.TributosPorCodigo)
	if len(dst.TributosPorCodigo) == 0 && strings.TrimSpace(src.OtrosTributos) != "" {
		mergeTributosPorCodigo(dst, ParseOtrosTributosText(src.OtrosTributos))
	}

	fillIfEmpty(&dst.EmisorNit, src.EmisorNit)
	fillIfEmpty(&dst.EmisorNrc, src.EmisorNrc)
	fillIfEmpty(&dst.EmisorNombre, src.EmisorNombre)
	fillIfEmpty(&dst.EmisorCodActividad, src.EmisorCodActividad)
	fillIfEmpty(&dst.EmisorDescActividad, src.EmisorDescActividad)
	fillIfEmpty(&dst.EmisorNombreComercial, src.EmisorNombreComercial)
	fillIfEmpty(&dst.EmisorTelefono, src.EmisorTelefono)
	fillIfEmpty(&dst.EmisorCorreo, src.EmisorCorreo)
	fillIfEmpty(&dst.ReceptorNit, src.ReceptorNit)
	fillIfEmpty(&dst.ReceptorNrc, src.ReceptorNrc)
	fillIfEmpty(&dst.ReceptorNombre, src.ReceptorNombre)
	fillIfEmpty(&dst.ReceptorCodActividad, src.ReceptorCodActividad)
	fillIfEmpty(&dst.ReceptorDescActividad, src.ReceptorDescActividad)
	fillIfEmpty(&dst.ReceptorDepartamento, src.ReceptorDepartamento)
	fillIfEmpty(&dst.ReceptorMunicipio, src.ReceptorMunicipio)
	fillIfEmpty(&dst.ReceptorComplemento, src.ReceptorComplemento)
	fillIfEmpty(&dst.ReceptorTelefono, src.ReceptorTelefono)
	fillIfEmpty(&dst.ReceptorCorreo, src.ReceptorCorreo)
	fillIfEmpty(&dst.ReceptorNombreComercial, src.ReceptorNombreComercial)
}

func NormalizeJSONDate(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if len(raw) >= 10 {
		raw = raw[:10]
	}
	normalized := NormalizarFecha(raw)
	if len(normalized) == 10 && normalized[4] == '-' && normalized[7] == '-' {
		return normalized
	}
	return ""
}

func extractSelloFromJSON(item map[string]any) string {
	paths := []any{
		item["selloRecibido"],
		item["selloRecepcion"],
		item["SelloRecibido"],
		item["SelloRecepcion"],
	}
	for _, path := range paths {
		if value := strings.TrimSpace(jsonAsString(path)); value != "" {
			return value
		}
	}

	nestedKeys := []string{"respuestaHacienda", "responseHacienda", "responseMH"}
	nestedFields := []string{"selloRecibido", "selloRecepcion", "SelloRecibido", "SelloRecepcion"}
	for _, key := range nestedKeys {
		nested := jsonAsMap(item[key])
		for _, field := range nestedFields {
			if value := strings.TrimSpace(jsonAsString(nested[field])); value != "" {
				return value
			}
		}
	}

	return ""
}

func extractMontoTotalFromResumen(resumen map[string]any) string {
	candidates := []string{
		jsonAsString(resumen["montoTotalOperacion"]),
		jsonAsString(resumen["subTotalVentas"]),
		jsonAsString(resumen["totalGravada"]),
	}
	for _, value := range candidates {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func extractIVAFromResumen(resumen map[string]any) string {
	if value := strings.TrimSpace(jsonAsString(resumen["totalIva"])); value != "" {
		return value
	}
	if tributos, ok := resumen["tributos"].([]any); ok {
		for _, item := range tributos {
			tributo := jsonAsMap(item)
			if jsonAsString(tributo["codigo"]) == "20" {
				if value := strings.TrimSpace(jsonAsString(tributo["valor"])); value != "" {
					return value
				}
			}
		}
	}
	return ""
}

func extractTributosPorCodigoFromResumen(resumen map[string]any) map[string]string {
	tributos, ok := resumen["tributos"].([]any)
	if !ok {
		return nil
	}
	items := make([]publicAPITributo, 0, len(tributos))
	for _, item := range tributos {
		tributo := jsonAsMap(item)
		codigo := jsonAsString(tributo["codigo"])
		if codigo == "" {
			continue
		}
		var valor *float64
		if raw := tributo["valor"]; raw != nil {
			if f, ok := raw.(float64); ok {
				valor = &f
			}
		}
		items = append(items, publicAPITributo{Codigo: codigo, Valor: valor})
	}
	return CollectTributosFromAPI(items)
}

func extractOtrosTributos(resumen map[string]any) string {
	fromMap := extractTributosPorCodigoFromResumen(resumen)
	if len(fromMap) > 0 {
		return formatOtrosTributosFromMap(fromMap)
	}
	return jsonAsString(resumen["totalOtrosTributos"])
}

func fillIfEmpty(target *string, value string) {
	if target == nil {
		return
	}
	if strings.TrimSpace(*target) != "" {
		return
	}
	*target = strings.TrimSpace(value)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func jsonAsMap(value any) map[string]any {
	if typed, ok := value.(map[string]any); ok {
		return typed
	}
	return map[string]any{}
}

func jsonAsString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return fmt.Sprintf("%.2f", typed)
	case int:
		return fmt.Sprintf("%d", typed)
	case int64:
		return fmt.Sprintf("%d", typed)
	case nil:
		return ""
	default:
		return fmt.Sprint(typed)
	}
}
