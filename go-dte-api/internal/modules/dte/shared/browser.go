package shared

import (
	"context"
	"errors"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
)

type Scraper struct {
	browserCtx context.Context
	cancel     context.CancelFunc
}

func NewScraper(parent context.Context) (*Scraper, error) {
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-background-networking", true),
		chromedp.Flag("disable-extensions", true),
		chromedp.Flag("disable-sync", true),
		chromedp.Flag("disable-images", true),
		chromedp.Flag("blink-settings", "imagesEnabled=false"),
		chromedp.Flag("disable-translate", true),
		chromedp.Flag("mute-audio", true),
		chromedp.Flag("disable-default-apps", true),
		chromedp.UserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 VerificadorDTE-Go/1.0 Chrome Safari"),
	)

	allocCtx, cancelAlloc := chromedp.NewExecAllocator(parent, opts...)
	browserCtx, cancelBrowser := chromedp.NewContext(allocCtx)

	if err := chromedp.Run(browserCtx); err != nil {
		cancelBrowser()
		cancelAlloc()
		return nil, err
	}

	return &Scraper{
		browserCtx: browserCtx,
		cancel: func() {
			cancelBrowser()
			cancelAlloc()
		},
	}, nil
}

func (s *Scraper) Close() {
	if s != nil && s.cancel != nil {
		s.cancel()
	}
}

func ConsultarDTE(parent context.Context, rawURL string) Result {
	scraper, err := NewScraper(parent)
	if err != nil {
		return baseErrorResult(rawURL, err)
	}
	defer scraper.Close()

	return scraper.ConsultarDTE(parent, rawURL)
}

func (s *Scraper) ConsultarDTE(parent context.Context, rawURL string) Result {
	sanitized := SanitizarURL(rawURL)
	parsed, _ := url.Parse(sanitized)
	query := parsed.Query()

	result := Result{
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
	}

	ctx, cancel := chromedp.NewContext(s.browserCtx)
	defer cancel()

	var html string
	err := chromedp.Run(ctx,
		network.Enable(),
		network.SetBlockedURLs([]string{
			"*.png", "*.jpg", "*.jpeg", "*.gif", "*.webp", "*.svg", "*.ico",
			"*.css", "*.woff", "*.woff2", "*.ttf", "*.otf", "*.mp4", "*.webm",
		}),
		chromedp.Navigate(sanitized),
		chromedp.WaitReady("body", chromedp.ByQuery),
		chromedp.Evaluate(clickSearchButtonJS, nil),
		waitForScrapeReady(),
		chromedp.OuterHTML("html", &html),
	)
	if err != nil {
		result.Error = err.Error()
		if errors.Is(err, errScrapeNotReady) {
			result.Estado = "ERROR"
		}
		return result
	}

	result = MapHTMLResult(html, result)
	return result
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

func waitForScrapeReady() chromedp.Action {
	return chromedp.ActionFunc(func(ctx context.Context) error {
		deadline := time.Now().Add(12 * time.Second)
		basicSeen := false
		for time.Now().Before(deadline) {
			var ready bool
			err := chromedp.Evaluate(scrapeReadyJS, &ready).Do(ctx)
			if err != nil {
				return err
			}
			if ready {
				time.Sleep(150 * time.Millisecond)
				return nil
			}

			var bodyText string
			_ = chromedp.Evaluate(`(document.body && document.body.innerText) || ""`, &bodyText).Do(ctx)
			if scrapeReadyBasic(bodyText) {
				basicSeen = true
			}

			interval := 150 * time.Millisecond
			if basicSeen {
				interval = 80 * time.Millisecond
			}
			time.Sleep(interval)
		}
		return errScrapeNotReady
	})
}

func scrapeReadyBasic(bodyText string) bool {
	text := strings.ToLower(bodyText)
	return strings.Contains(text, "estado del dte") ||
		strings.Contains(text, "estado del documento") ||
		strings.Contains(text, "no encontrado") ||
		strings.Contains(text, "no existe") ||
		strings.Contains(text, "transmitido satisfactoriamente") ||
		strings.Contains(text, "rechazado") ||
		strings.Contains(text, "invalidado")
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

const clickSearchButtonJS = `(function(){
  const candidates = Array.from(document.querySelectorAll('button,input[type=button],input[type=submit],a'));
  const target = candidates.find(el => /Realizar\s+B[uú]squeda/i.test((el.innerText || el.value || '').trim()));
  if (target) target.click();
})();`

const scrapeReadyJS = `(function(){
  const bodyText = (document.body && document.body.innerText) || '';
  const text = bodyText.toLowerCase();
  const basic = text.includes('estado del dte')
    || text.includes('estado del documento')
    || text.includes('no encontrado')
    || text.includes('no existe')
    || text.includes('transmitido satisfactoriamente')
    || text.includes('rechazado')
    || text.includes('invalidado');
  if (!basic) return false;

  const needsRelated = text.includes('documentos relacionados')
    || text.includes('documento ha sido ajustado');
  if (!needsRelated) return true;

  const uuids = bodyText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || [];
  return uuids.length >= 2;
})();`

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
