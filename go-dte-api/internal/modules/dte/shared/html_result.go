package shared

import (
	"context"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

func ConsultarDTE(parent context.Context, rawURL string) Result {
	scraper := NewPublicAPIScraper()
	return scraper.ConsultarDTE(parent, rawURL)
}

func baseErrorResult(rawURL string, err error) Result {
	sanitized := SanitizarURL(rawURL)
	parsed, _ := url.Parse(sanitized)
	query := parsed.Query()

	msg := ""
	if err != nil {
		msg = err.Error()
	}

	return Result{
		OK:            false,
		URL:           sanitized,
		LinkVisita:    sanitized,
		Visitar:       "Abrir",
		Host:          parsed.Host,
		Ambiente:      firstQuery(query, "ambiente"),
		CodGen:        strings.ToUpper(firstQuery(query, "codGen")),
		FechaEmi:      firstQuery(query, "fechaEmi"),
		TipoDteNorm:   "SIN_TIPO",
		Estado:        "ERROR",
		Relacionados:  []RelatedDocument{},
		Observaciones: []Observation{},
		Error:         msg,
	}
}

func MapHTMLResult(html string, base Result) Result {
	pairs := pairsFromHTML(html)
	detail := mapDetail(pairs)

	if detail.EstadoRaw == "" || detail.Estado == "DESCONOCIDO" {
		text := stripTags(html)
		estado := regexp.MustCompile(`(?i)Estado[^:]*:\s*([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+)`).FindStringSubmatch(text)
		if len(estado) > 1 {
			detail.EstadoRaw = Clean(estado[1])
		}
		estimated := NormalizarEstado(valueOr(detail.EstadoRaw, text))
		if estimated != "DESCONOCIDO" {
			detail.Estado = estimated
		}
	}

	applyTipoDteTextFallback(html, &detail)

	if detail.CodigoGeneracion == "" {
		detail.CodigoGeneracion = base.CodGen
	}

	detail.URL = base.URL
	detail.LinkVisita = base.LinkVisita
	detail.Visitar = "Abrir"
	detail.Host = base.Host
	detail.Ambiente = base.Ambiente
	detail.CodGen = base.CodGen
	detail.FechaEmi = base.FechaEmi
	detail.OK = detail.Estado != "ERROR"
	detail.Observaciones = extractObservations(html)
	detail.Relacionados = extractRelated(html)
	if len(detail.Observaciones) > 0 {
		lines := make([]string, 0, len(detail.Observaciones))
		for _, obs := range detail.Observaciones {
			lines = append(lines, obs.Numero+". "+obs.Observacion)
		}
		detail.ObservacionesTexto = strings.Join(lines, "\n")
	}
	if len(detail.Relacionados) > 0 {
		detail.RelacionadosTexto = formatRelacionadosTexto(detail.Relacionados)
	}

	return detail
}

func formatRelacionadosTexto(relacionados []RelatedDocument) string {
	lines := make([]string, 0, len(relacionados))
	for i, rel := range relacionados {
		lines = append(lines, strings.Join([]string{
			strconv.Itoa(i+1) + ". " + rel.TipoDocumentacion,
			rel.CodigoGeneracion,
			rel.FechaGeneracion,
			rel.SelloRecepcion,
		}, " | "))
	}
	return strings.Join(lines, "\n")
}

func tableHeaders(table *goquery.Selection) []string {
	headers := []string{}
	table.Find("thead th, tr:first-child th").Each(func(_ int, th *goquery.Selection) {
		headers = append(headers, normalizeLabel(th.Text()))
	})
	return headers
}

func extractRelated(html string) []RelatedDocument {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil
	}

	var rows []RelatedDocument
	doc.Find("table").EachWithBreak(func(_ int, table *goquery.Selection) bool {
		headers := tableHeaders(table)
		joined := strings.Join(headers, "|")
		if !strings.Contains(joined, "fecha de generacion") || !strings.Contains(joined, "codigo de generacion") || !strings.Contains(joined, "sello de recepcion") {
			return true
		}

		tipoIdx := indexOfTipoHeader(headers)
		fechaIdx := indexOfHeader(headers, "fecha de generacion", 1)
		codigoIdx := indexOfHeader(headers, "codigo de generacion", 2)
		selloIdx := indexOfHeader(headers, "sello de recepcion", 3)
		table.Find("tbody tr").Each(func(_ int, tr *goquery.Selection) {
			cells := tr.Find("td")
			codigo := Clean(cells.Eq(codigoIdx).Text())
			if codigo == "" {
				return
			}
			rows = append(rows, RelatedDocument{
				FechaGeneracion:   Clean(cells.Eq(fechaIdx).Text()),
				CodigoGeneracion:  codigo,
				SelloRecepcion:    Clean(cells.Eq(selloIdx).Text()),
				TipoDocumentacion: Clean(cells.Eq(tipoIdx).Text()),
			})
		})
		return false
	})
	return rows
}

func extractObservations(html string) []Observation {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil
	}

	var rows []Observation
	doc.Find("table").EachWithBreak(func(_ int, table *goquery.Selection) bool {
		headers := tableHeaders(table)
		if !strings.Contains(strings.Join(headers, "|"), "observacion") {
			return true
		}
		obsIdx := indexOfHeader(headers, "observacion", 1)
		table.Find("tbody tr").Each(func(i int, tr *goquery.Selection) {
			obs := Clean(tr.Find("td").Eq(obsIdx).Text())
			if obs != "" {
				rows = append(rows, Observation{Numero: Clean(tr.Find("td").Eq(0).Text()), Observacion: obs})
				if rows[len(rows)-1].Numero == "" {
					rows[len(rows)-1].Numero = string(rune('1' + i))
				}
			}
		})
		return false
	})
	return rows
}

func normalizeLabel(s string) string {
	s = removeAccents(strings.ToLower(Clean(s)))
	s = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(s, " ")
	return strings.TrimSpace(s)
}

func indexOfHeader(headers []string, needle string, fallback int) int {
	for i, h := range headers {
		if strings.Contains(h, needle) {
			return i
		}
	}
	return fallback
}

func indexOfHeaderAny(headers []string, needles []string, fallback int) int {
	for _, needle := range needles {
		for i, h := range headers {
			if strings.Contains(h, needle) {
				return i
			}
		}
	}
	return fallback
}

func indexOfTipoHeader(headers []string) int {
	if idx := indexOfHeaderAny(headers, []string{"tipo de documento", "tipo de documentacion"}, -1); idx >= 0 {
		return idx
	}
	for i, h := range headers {
		if strings.Contains(h, "tipo") && strings.Contains(h, "documento") {
			return i
		}
	}
	if len(headers) > 0 {
		return len(headers) - 1
	}
	return 4
}

func stripTags(html string) string {
	return Clean(regexp.MustCompile(`<[^>]+>`).ReplaceAllString(html, " "))
}

var uuidInTextPattern = regexp.MustCompile(`(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)

func scrapeReadyFromText(bodyText string) bool {
	text := strings.ToLower(bodyText)
	basic := strings.Contains(text, "estado del dte") ||
		strings.Contains(text, "estado del documento") ||
		strings.Contains(text, "no encontrado") ||
		strings.Contains(text, "no existe") ||
		strings.Contains(text, "transmitido satisfactoriamente") ||
		strings.Contains(text, "rechazado") ||
		strings.Contains(text, "invalidado")
	if !basic {
		return false
	}

	needsRelated := strings.Contains(text, "documentos relacionados") ||
		strings.Contains(text, "documento ha sido ajustado")
	if !needsRelated {
		return true
	}

	return len(uuidInTextPattern.FindAllString(bodyText, -1)) >= 2
}
