package shared

import (
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

func pairsFromHTML(html string) map[string]string {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return map[string]string{}
	}

	pairs := map[string]string{}
	add := func(k, v string) {
		k = strings.TrimSuffix(Clean(k), ":")
		v = Clean(v)
		if k == "" || v == "" || looksLikeSearchButton(v) {
			return
		}
		if len([]rune(k)) > 50 {
			return
		}
		pairs[k] = v
		pairs[normalizeLabel(k)] = v
	}

	doc.Find("table").Each(func(_ int, table *goquery.Selection) {
		table.Find("tr").Each(func(_ int, tr *goquery.Selection) {
			selection := tr.ChildrenFiltered("th, td")
			if selection.Length() < 2 {
				return
			}
			for i := 0; i < selection.Length()-1; i++ {
				key := selection.Eq(i).Text()
				value := selection.Eq(i + 1).Text()
				keyClean := Clean(key)
				if strings.HasSuffix(keyClean, ":") || len([]rune(keyClean)) <= 50 {
					add(key, value)
				}
			}
		})
	})

	doc.Find("dl dt").Each(func(_ int, dt *goquery.Selection) {
		dd := dt.NextFiltered("dd")
		if dd.Length() == 0 {
			dd = dt.NextAllFiltered("dd").First()
		}
		if dd.Length() > 0 {
			add(dt.Text(), dd.Text())
		}
	})

	doc.Find(".form-group.row, .row").Each(func(_ int, row *goquery.Selection) {
		labels := row.Find("label")
		if labels.Length() < 2 {
			return
		}
		key := labels.Eq(0).Text()
		if !strings.HasSuffix(Clean(key), ":") {
			return
		}
		add(key, labels.Eq(1).Text())
	})

	doc.Find("label, span, strong, b, td, th, dt, p, div").Each(func(_ int, s *goquery.Selection) {
		label := Clean(s.Text())
		if label == "" || !strings.HasSuffix(label, ":") {
			return
		}
		label = strings.TrimSuffix(label, ":")
		if len([]rune(label)) > 50 {
			return
		}

		next := s.Next()
		for next.Length() > 0 && Clean(next.Text()) == "" {
			next = next.Next()
		}
		if next.Length() > 0 {
			add(label, next.Text())
			return
		}

		parent := s.Parent()
		if parent.Length() == 0 {
			return
		}
		foundSelf := false
		parent.Contents().Each(func(_ int, node *goquery.Selection) {
			text := Clean(node.Text())
			if text == "" {
				return
			}
			if !foundSelf {
				nodeText := Clean(s.Text())
				if strings.HasPrefix(text, nodeText) || text == nodeText {
					foundSelf = true
				}
				return
			}
			add(label, text)
		})
	})

	return pairs
}

func looksLikeSearchButton(value string) bool {
	lower := strings.ToLower(value)
	return strings.Contains(lower, "realizar busqueda") || strings.Contains(lower, "realizar búsqueda")
}

func mapDetail(pairs map[string]string) Result {
	get := func(names ...string) string {
		for _, name := range names {
			if value := pairs[name]; value != "" {
				return value
			}
			if value := pairs[normalizeLabel(name)]; value != "" {
				return value
			}
		}
		return ""
	}

	estadoRaw := get("Estado del DTE", "Estado del documento", "Estado del Documento", "Estado")
	tipoDte := get(
		"Tipo de DTE",
		"Tipo DTE",
		"Tipo de Dte",
		"Tipo Dte",
		"Tipo Documento",
		"Tipo documento",
		"Clasificación",
		"Clasificacion",
	)
	documentoAjustado := get("Documento ajustado", "Documento Ajustado", "Ajuste")

	return Result{
		Estado:                 NormalizarEstado(estadoRaw),
		EstadoRaw:              estadoRaw,
		TipoDte:                tipoDte,
		TipoDteNorm:            NormalizarTipoDte(tipoDte),
		DescripcionEstado:      get("Descripcion del DTE", "Descripción del DTE", "Descripcion del Estado", "Descripción del Estado", "Descripcion", "Descripción"),
		FechaHoraGeneracion:    get("Fecha y Hora de Generación", "Fecha y Hora de Generacion", "Fecha de Generación", "Fecha de Generacion"),
		FechaHoraTransmision:   get("Fecha y Hora de Transmisión", "Fecha y Hora de Transmision", "Fecha y Hora de Transmisi n", "Fecha de Transmisión", "Fecha de Transmision", "Fecha de Transmisi n"),
		FechaHoraProcesamiento: get("Fecha y Hora de Procesamiento", "Fecha de Procesamiento"),
		CodigoGeneracion:       get("Código de Generación", "Codigo de Generacion", "Código Generación", "Codigo Generacion"),
		SelloRecepcion:         get("Sello de Recepción", "Sello de Recepcion", "Sello"),
		NumeroControl:          get("Número de Control", "Numero de Control", "N° Control", "No. de Control"),
		MontoTotal:             get("Monto Total de la Operación", "Monto Total de la Operacion", "Monto Total", "Total a pagar"),
		IvaOperaciones:         get("IVA de las operaciones", "IVA de las Operaciones"),
		IvaPercibido:           get("IVA percibido", "IVA Percibido"),
		IvaRetenido:            get("IVA retenido", "IVA Retenido"),
		RetencionRenta:         get("Retención renta", "Retencion renta", "Retenci n renta"),
		TotalNoAfectos:         get("Total valores no afectos", "Total Valores no Afectos", "Valores no afectos"),
		TotalPagarOperacion:    get("Total a pagar/Total de operación", "Total a pagar/Total de operacion", "Total a pagar / Total de operación", "Total de operaci n", "Total de operación", "Total de Operación", "Total de Operaci n"),
		OtrosTributos:          get("Otros tributos", "Otros Tributos"),
		DocumentoAjustado:      documentoAjustado,
		DocumentoEventoAplicado: get(
			"Documento con Evento aplicado",
			"Documento con evento aplicado",
			"Documento con Evento Aplicado",
			"Evento aplicado",
		),
		Ajustado: strings.Contains(strings.ToLower(documentoAjustado), "ajustad"),
		Error:    "",
	}
}

func applyTipoDteTextFallback(html string, detail *Result) {
	if detail == nil || detail.TipoDte != "" {
		return
	}
	text := stripTags(html)
	match := regexp.MustCompile(`(?i)Tipo\s+de\s+DTE[^:]*:\s*([^\n<]+)`).FindStringSubmatch(text)
	if len(match) < 2 {
		return
	}
	tipoDte := Clean(match[1])
	if tipoDte == "" {
		return
	}
	detail.TipoDte = tipoDte
	detail.TipoDteNorm = NormalizarTipoDte(tipoDte)
}
