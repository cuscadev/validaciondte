package shared

import (
	"fmt"
	"strings"
)

func ResultLookupKey(codGen, fecha string) string {
	cod := strings.ToUpper(strings.TrimSpace(codGen))
	fechaNorm := NormalizarFecha(strings.TrimSpace(fecha))
	if len(fechaNorm) >= 10 {
		fechaNorm = fechaNorm[:10]
	}
	return cod + "|" + fechaNorm
}

func ExtractDTEJSONFields(item map[string]any) Result {
	ident := jsonAsMap(item["identificacion"])
	emisor := jsonAsMap(item["emisor"])
	receptor := jsonAsMap(item["receptor"])
	direccion := jsonAsMap(receptor["direccion"])
	resumen := jsonAsMap(item["resumen"])

	codGen := strings.ToUpper(strings.TrimSpace(jsonAsString(ident["codigoGeneracion"])))
	fechaYMD := NormalizeJSONDate(jsonAsString(ident["fecEmi"]))
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
		MontoTotal:       extractMontoTotalFromResumen(resumen),
		IvaOperaciones:   extractIVAFromResumen(resumen),
		IvaPercibido:     firstNonEmpty(jsonAsString(resumen["ivaPerci1"]), jsonAsString(resumen["ivaPercibido"])),
		IvaRetenido:      firstNonEmpty(jsonAsString(resumen["ivaRete1"]), jsonAsString(resumen["ivaRetenido"])),
		RetencionRenta:   jsonAsString(resumen["reteRenta"]),
		TotalNoAfectos:   firstNonEmpty(jsonAsString(resumen["totalNoSuj"]), jsonAsString(resumen["totalExenta"])),
		TotalPagarOperacion: firstNonEmpty(
			jsonAsString(resumen["totalPagar"]),
			jsonAsString(resumen["montoTotalOperacion"]),
		),
		OtrosTributos: extractOtrosTributos(resumen),

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
	fillIfEmpty(&dst.IvaOperaciones, src.IvaOperaciones)
	fillIfEmpty(&dst.IvaPercibido, src.IvaPercibido)
	fillIfEmpty(&dst.IvaRetenido, src.IvaRetenido)
	fillIfEmpty(&dst.RetencionRenta, src.RetencionRenta)
	fillIfEmpty(&dst.TotalNoAfectos, src.TotalNoAfectos)
	fillIfEmpty(&dst.TotalPagarOperacion, src.TotalPagarOperacion)
	fillIfEmpty(&dst.OtrosTributos, src.OtrosTributos)

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

func extractOtrosTributos(resumen map[string]any) string {
	if tributos, ok := resumen["tributos"].([]any); ok {
		parts := make([]string, 0, len(tributos))
		for _, item := range tributos {
			tributo := jsonAsMap(item)
			codigo := jsonAsString(tributo["codigo"])
			valor := jsonAsString(tributo["valor"])
			if codigo != "" && valor != "" && codigo != "20" {
				parts = append(parts, codigo+": "+valor)
			}
		}
		if len(parts) > 0 {
			return strings.Join(parts, "; ")
		}
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
