package shared

import (
	"sort"
	"strings"
)

const ivaTributoCodigo = "20"

func tributoColumnName(codigo string) string {
	return "tributo_" + strings.TrimSpace(codigo)
}

func CollectTributosFromAPI(items []publicAPITributo) map[string]string {
	out := map[string]string{}
	for _, item := range items {
		codigo := strings.TrimSpace(item.Codigo)
		valor := formatAPIAmount(item.Valor)
		if codigo == "" || valor == "" || codigo == ivaTributoCodigo {
			continue
		}
		out[codigo] = valor
	}
	return out
}

func ParseOtrosTributosText(text string) map[string]string {
	out := map[string]string{}
	text = strings.TrimSpace(text)
	if text == "" {
		return out
	}
	for _, part := range strings.Split(text, ";") {
		part = strings.TrimSpace(part)
		idx := strings.Index(part, ":")
		if idx <= 0 {
			continue
		}
		codigo := strings.TrimSpace(part[:idx])
		valor := strings.TrimSpace(part[idx+1:])
		if codigo == "" || valor == "" || codigo == ivaTributoCodigo {
			continue
		}
		out[codigo] = valor
	}
	return out
}

func ResolveTributosPorCodigo(r Result) map[string]string {
	if len(r.TributosPorCodigo) > 0 {
		return r.TributosPorCodigo
	}
	return ParseOtrosTributosText(r.OtrosTributos)
}

func CollectTributoCodes(results []Result) []string {
	seen := map[string]bool{}
	for _, result := range results {
		for codigo := range ResolveTributosPorCodigo(result) {
			seen[codigo] = true
		}
	}
	codes := make([]string, 0, len(seen))
	for codigo := range seen {
		codes = append(codes, codigo)
	}
	sort.Strings(codes)
	return codes
}

func applyTributosPorCodigo(result *Result, items []publicAPITributo) {
	if result == nil {
		return
	}
	fromAPI := CollectTributosFromAPI(items)
	if len(fromAPI) == 0 {
		return
	}
	result.TributosPorCodigo = fromAPI
	result.OtrosTributos = formatOtrosTributosFromMap(fromAPI)
}

func formatOtrosTributosFromMap(items map[string]string) string {
	if len(items) == 0 {
		return ""
	}
	codes := make([]string, 0, len(items))
	for codigo := range items {
		codes = append(codes, codigo)
	}
	sort.Strings(codes)
	parts := make([]string, 0, len(codes))
	for _, codigo := range codes {
		parts = append(parts, codigo+": "+items[codigo])
	}
	return strings.Join(parts, "; ")
}

func mergeTributosPorCodigo(dst *Result, src map[string]string) {
	if dst == nil || len(src) == 0 {
		return
	}
	if dst.TributosPorCodigo == nil {
		dst.TributosPorCodigo = map[string]string{}
	}
	for codigo, valor := range src {
		if strings.TrimSpace(valor) == "" {
			continue
		}
		if _, exists := dst.TributosPorCodigo[codigo]; !exists {
			dst.TributosPorCodigo[codigo] = valor
		}
	}
	if strings.TrimSpace(dst.OtrosTributos) == "" && len(dst.TributosPorCodigo) > 0 {
		dst.OtrosTributos = formatOtrosTributosFromMap(dst.TributosPorCodigo)
	}
}
