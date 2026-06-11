package shared

import (
	"strconv"
	"strings"
	"unicode"
)

// Catálogo público: https://admin.factura.gob.sv/prod/catalogo/inconsistencia
type inconsistenciaEntry struct {
	Codigo      string
	Descripcion string
	Estado      string
}

type inconsistenciaGroup struct {
	Codigo          string
	Descripcion     string
	Inconsistencias []inconsistenciaEntry
}

var haciendaInconsistenciaCatalog = []inconsistenciaGroup{
	{
		Codigo:      "SR",
		Descripcion: "Satisfactorio",
		Inconsistencias: []inconsistenciaEntry{
			{Codigo: "SR01", Descripcion: "DTE no contiene sello de recepción", Estado: "SR"},
			{Codigo: "SR02", Descripcion: "Diferencia en monto de la operación", Estado: "SR"},
			{Codigo: "SR03", Descripcion: "Diferencia en fecha/hora de DTE", Estado: "SR"},
			{Codigo: "SR04", Descripcion: "DTE de operación inexistente", Estado: "SR"},
			{Codigo: "SR05", Descripcion: "Diferencia en datos de identificación del DTE ", Estado: "SR"},
			{Codigo: "SR06", Descripcion: "Otro", Estado: "SR"},
		},
	},
	{
		Codigo:      "SRO",
		Descripcion: "Satisfactorio con Observacion",
		Inconsistencias: []inconsistenciaEntry{
			{Codigo: "SRO01", Descripcion: "DTE no contiene sello de recepción", Estado: "SRO"},
			{Codigo: "SRO02", Descripcion: "Ajuste al documento no autorizado por el Receptor", Estado: "SRO"},
			{Codigo: "SRO03", Descripcion: "Diferencia en monto de la operación", Estado: "SRO"},
			{Codigo: "SRO04", Descripcion: "Diferencia en fecha/hora de DTE ", Estado: "SRO"},
			{Codigo: "SRO05", Descripcion: "DTE de operación inexistente", Estado: "SRO"},
			{Codigo: "SRO06", Descripcion: "Diferencia en datos de identificación del DTE", Estado: "SRO"},
			{Codigo: "SRO07", Descripcion: "Otro", Estado: "SRO"},
		},
	},
	{
		Codigo:      "SRA",
		Descripcion: "Satisfactorio con Ajuste",
		Inconsistencias: []inconsistenciaEntry{
			{Codigo: "SRA01", Descripcion: "DTE no contiene sello de recepción", Estado: "SRA"},
			{Codigo: "SRA02", Descripcion: "Ajuste al documento no autorizado por el Receptor", Estado: "SRA"},
			{Codigo: "SRA03", Descripcion: "Diferencia en monto de la operación", Estado: "SRA"},
			{Codigo: "SRA04", Descripcion: "Diferencia en fecha/hora de DTE", Estado: "SRA"},
			{Codigo: "SRA05", Descripcion: "DTE de operación inexistente", Estado: "SRA"},
			{Codigo: "SRA06", Descripcion: "Diferencia en datos de identificación del DTE", Estado: "SRA"},
			{Codigo: "SRA07", Descripcion: "Otro", Estado: "SRA"},
		},
	},
	{
		Codigo:      "INV",
		Descripcion: "Invalido",
		Inconsistencias: []inconsistenciaEntry{
			{Codigo: "INV01", Descripcion: "Invalidación de DTE sin autorización del Receptor", Estado: "INV"},
		},
	},
	{
		Codigo:      "EE",
		Descripcion: "Error",
		Inconsistencias: []inconsistenciaEntry{
			{Codigo: "EE01", Descripcion: "DTE no ha sido transmitido", Estado: "EE"},
		},
	},
	{
		Codigo:      "RE",
		Descripcion: "RECHAZADO",
		Inconsistencias: []inconsistenciaEntry{
			{Codigo: "RE01", Descripcion: "DTE aparece con estado rechazado", Estado: "RE"},
		},
	},
}

func lookupInconsistenciaGroup(estadoDocInc string) (inconsistenciaGroup, bool) {
	code := strings.ToUpper(strings.TrimSpace(estadoDocInc))
	for _, group := range haciendaInconsistenciaCatalog {
		if group.Codigo == code {
			return group, true
		}
	}
	return inconsistenciaGroup{}, false
}

func resolveEstadoDocIncDescripcion(estadoDocInc string) string {
	group, ok := lookupInconsistenciaGroup(estadoDocInc)
	if !ok {
		return ""
	}
	return group.Descripcion
}

func resolveInconsistenciaCodigo(estadoDocInc, observacion string) (codigo, descripcion string) {
	group, ok := lookupInconsistenciaGroup(estadoDocInc)
	if !ok || len(group.Inconsistencias) == 0 {
		return "", ""
	}

	obs := normalizeInconsistenciaText(observacion)
	if obs == "" {
		return "", ""
	}

	if entry, ok := matchInconsistenciaEntry(obs, group.Inconsistencias); ok {
		return entry.Codigo, strings.TrimSpace(entry.Descripcion)
	}
	return "", ""
}

func matchInconsistenciaEntry(obs string, entries []inconsistenciaEntry) (inconsistenciaEntry, bool) {
	type rule struct {
		match func(string) bool
		pick  func([]inconsistenciaEntry) (inconsistenciaEntry, bool)
	}
	rules := []rule{
		{
			match: func(s string) bool { return strings.Contains(s, "sello") },
			pick:  func(es []inconsistenciaEntry) (inconsistenciaEntry, bool) { return findByDescKeyword(es, "sello") },
		},
		{
			match: func(s string) bool { return strings.Contains(s, "ajuste") },
			pick: func(es []inconsistenciaEntry) (inconsistenciaEntry, bool) {
				return findByDescKeywords(es, "ajuste", "autoriz")
			},
		},
		{
			match: func(s string) bool { return strings.Contains(s, "monto") },
			pick:  func(es []inconsistenciaEntry) (inconsistenciaEntry, bool) { return findByDescKeyword(es, "monto") },
		},
		{
			match: func(s string) bool {
				return strings.Contains(s, "fecha") || strings.Contains(s, "hora") || strings.Contains(s, "fecemi")
			},
			pick: func(es []inconsistenciaEntry) (inconsistenciaEntry, bool) {
				for _, entry := range es {
					desc := normalizeInconsistenciaText(entry.Descripcion)
					if strings.Contains(desc, "fecha") || strings.Contains(desc, "hora") {
						return entry, true
					}
				}
				return inconsistenciaEntry{}, false
			},
		},
		{
			match: func(s string) bool { return strings.Contains(s, "inexistente") },
			pick:  func(es []inconsistenciaEntry) (inconsistenciaEntry, bool) { return findByDescKeyword(es, "inexistente") },
		},
		{
			match: func(s string) bool {
				return strings.Contains(s, "identificacion") || strings.Contains(s, "identific")
			},
			pick: func(es []inconsistenciaEntry) (inconsistenciaEntry, bool) {
				return findByDescKeyword(es, "identificacion")
			},
		},
	}

	for _, r := range rules {
		if !r.match(obs) {
			continue
		}
		if entry, ok := r.pick(entries); ok {
			return entry, true
		}
	}

	for _, entry := range entries {
		if strings.Contains(strings.ToLower(strings.TrimSpace(entry.Descripcion)), "otro") {
			return entry, true
		}
	}
	if len(entries) > 0 {
		return entries[len(entries)-1], true
	}
	return inconsistenciaEntry{}, false
}

func findByDescKeyword(entries []inconsistenciaEntry, keyword string) (inconsistenciaEntry, bool) {
	needle := normalizeInconsistenciaText(keyword)
	for _, entry := range entries {
		if strings.Contains(normalizeInconsistenciaText(entry.Descripcion), needle) {
			return entry, true
		}
	}
	return inconsistenciaEntry{}, false
}

func findByDescKeywords(entries []inconsistenciaEntry, keywords ...string) (inconsistenciaEntry, bool) {
	for _, entry := range entries {
		desc := normalizeInconsistenciaText(entry.Descripcion)
		ok := true
		for _, keyword := range keywords {
			if !strings.Contains(desc, normalizeInconsistenciaText(keyword)) {
				ok = false
				break
			}
		}
		if ok {
			return entry, true
		}
	}
	return inconsistenciaEntry{}, false
}

func normalizeInconsistenciaText(value string) string {
	value = removeAccents(strings.ToLower(Clean(value)))
	var b strings.Builder
	for _, r := range value {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func formatInconsistenciasTexto(estadoDocInc string, items []Observation) string {
	if len(items) == 0 {
		return ""
	}
	lines := make([]string, 0, len(items))
	for _, item := range items {
		line := item.Numero + ". "
		code := strings.TrimSpace(item.CodigoInconsistencia)
		desc := strings.TrimSpace(item.DescripcionCatalogo)
		if code == "" && estadoDocInc != "" {
			code, desc = resolveInconsistenciaCodigo(estadoDocInc, item.Observacion)
		}
		if code != "" {
			line += code + ": "
			if desc != "" {
				line += desc + " - "
			}
		}
		line += item.Observacion
		lines = append(lines, line)
	}
	return strings.Join(lines, "\n")
}

func summarizeInconsistenciaCodigos(items []Observation) string {
	if len(items) == 0 {
		return ""
	}
	seen := map[string]bool{}
	codes := make([]string, 0, len(items))
	for _, item := range items {
		code := strings.TrimSpace(item.CodigoInconsistencia)
		if code == "" || seen[code] {
			continue
		}
		seen[code] = true
		codes = append(codes, code)
	}
	return strings.Join(codes, "; ")
}

func mapPublicAPIObservationsWithCatalog(estadoDocInc string, items []string) []Observation {
	out := make([]Observation, 0, len(items))
	for i, item := range items {
		text := Clean(item)
		if text == "" {
			continue
		}
		code, desc := resolveInconsistenciaCodigo(estadoDocInc, text)
		out = append(out, Observation{
			Numero:               strconv.Itoa(i + 1),
			Observacion:          text,
			CodigoInconsistencia: code,
			DescripcionCatalogo:  desc,
		})
	}
	return out
}
