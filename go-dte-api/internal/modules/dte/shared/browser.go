package shared

import (
	"context"
	"net/url"
	"regexp"
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
		waitForResultOrIdle(),
		chromedp.OuterHTML("html", &html),
	)
	if err != nil {
		result.Error = err.Error()
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

func waitForResultOrIdle() chromedp.Action {
	return chromedp.ActionFunc(func(ctx context.Context) error {
		deadline := time.Now().Add(8 * time.Second)
		for time.Now().Before(deadline) {
			var found bool
			err := chromedp.Evaluate(resultReadyJS, &found).Do(ctx)
			if err != nil {
				return err
			}
			if found {
				return nil
			}
			time.Sleep(150 * time.Millisecond)
		}
		return nil
	})
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
	detail.Relacionados = []RelatedDocument{}
	detail.Observaciones = extractObservations(html)

	if detail.Ajustado {
		detail.Relacionados = extractRelated(html)
	}
	if len(detail.Observaciones) > 0 {
		lines := make([]string, 0, len(detail.Observaciones))
		for _, obs := range detail.Observaciones {
			lines = append(lines, obs.Numero+". "+obs.Observacion)
		}
		detail.ObservacionesTexto = strings.Join(lines, "\n")
	}

	return detail
}

func pairsFromHTML(html string) map[string]string {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return map[string]string{}
	}

	pairs := map[string]string{}
	add := func(k, v string) {
		k = strings.TrimSuffix(Clean(k), ":")
		v = Clean(v)
		if k == "" || v == "" || strings.Contains(strings.ToLower(v), "realizar busqueda") || strings.Contains(strings.ToLower(v), "realizar búsqueda") {
			return
		}
		pairs[k] = v
		pairs[normalizeLabel(k)] = v
	}

	doc.Find("tr").Each(func(_ int, tr *goquery.Selection) {
		cells := tr.ChildrenFiltered("td, th")
		if cells.Length() >= 2 {
			add(cells.Eq(0).Text(), cells.Eq(1).Text())
		}
	})

	return pairs
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
	tipoDte := get("Tipo de DTE", "Tipo DTE", "Tipo de Dte", "Tipo Dte")
	documentoAjustado := get("Documento ajustado", "Documento Ajustado", "Ajuste")

	return Result{
		Estado:                 NormalizarEstado(estadoRaw),
		EstadoRaw:              estadoRaw,
		TipoDte:                tipoDte,
		TipoDteNorm:            NormalizarTipoDte(tipoDte),
		DescripcionEstado:      get("Descripcion del DTE", "Descripción del DTE", "Descripcion del Estado", "Descripción del Estado", "Descripcion", "Descripción"),
		FechaHoraGeneracion:    get("Fecha y Hora de Generación", "Fecha y Hora de Generacion", "Fecha de Generación", "Fecha de Generacion"),
		FechaHoraTransmision:   get("Fecha y Hora de Transmisión", "Fecha y Hora de Transmision", "Fecha de Transmisión", "Fecha de Transmision"),
		FechaHoraProcesamiento: get("Fecha y Hora de Procesamiento", "Fecha de Procesamiento"),
		CodigoGeneracion:       get("Código de Generación", "Codigo de Generacion", "Código Generación", "Codigo Generacion"),
		SelloRecepcion:         get("Sello de Recepción", "Sello de Recepcion", "Sello"),
		NumeroControl:          get("Número de Control", "Numero de Control", "N° Control", "No. de Control"),
		MontoTotal:             get("Monto Total de la Operación", "Monto Total de la Operacion", "Monto Total", "Total a pagar"),
		IvaOperaciones:         get("IVA de las operaciones", "IVA de las Operaciones"),
		IvaPercibido:           get("IVA percibido", "IVA Percibido"),
		IvaRetenido:            get("IVA retenido", "IVA Retenido"),
		RetencionRenta:         get("Retención renta", "Retencion renta"),
		TotalNoAfectos:         get("Total valores no afectos", "Total Valores no Afectos", "Valores no afectos"),
		TotalPagarOperacion:    get("Total a pagar/Total de operación", "Total a pagar/Total de operacion", "Total a pagar / Total de operación", "Total de operación", "Total de Operación"),
		OtrosTributos:          get("Otros tributos", "Otros Tributos"),
		DocumentoAjustado:      documentoAjustado,
		Ajustado:               strings.Contains(strings.ToLower(documentoAjustado), "ajustad"),
		Error:                  "",
	}
}

func extractRelated(html string) []RelatedDocument {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil
	}

	var rows []RelatedDocument
	doc.Find("table").EachWithBreak(func(_ int, table *goquery.Selection) bool {
		headers := []string{}
		table.Find("thead th, tr:first-child th").Each(func(_ int, th *goquery.Selection) {
			headers = append(headers, normalizeLabel(th.Text()))
		})
		joined := strings.Join(headers, "|")
		if !strings.Contains(joined, "fecha de generacion") || !strings.Contains(joined, "codigo de generacion") || !strings.Contains(joined, "sello de recepcion") {
			return true
		}

		table.Find("tbody tr").Each(func(_ int, tr *goquery.Selection) {
			cells := tr.Find("td")
			rows = append(rows, RelatedDocument{
				FechaGeneracion:   Clean(cells.Eq(indexOfHeader(headers, "fecha de generacion", 0)).Text()),
				CodigoGeneracion:  Clean(cells.Eq(indexOfHeader(headers, "codigo de generacion", 1)).Text()),
				SelloRecepcion:    Clean(cells.Eq(indexOfHeader(headers, "sello de recepcion", 2)).Text()),
				TipoDocumentacion: Clean(cells.Eq(indexOfHeader(headers, "tipo de documentacion", 3)).Text()),
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
		headers := []string{}
		table.Find("thead th, tr:first-child th").Each(func(_ int, th *goquery.Selection) {
			headers = append(headers, normalizeLabel(th.Text()))
		})
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

func stripTags(html string) string {
	return Clean(regexp.MustCompile(`<[^>]+>`).ReplaceAllString(html, " "))
}

const clickSearchButtonJS = `(function(){
  const candidates = Array.from(document.querySelectorAll('button,input[type=button],input[type=submit],a'));
  const target = candidates.find(el => /Realizar\s+B[uú]squeda/i.test((el.innerText || el.value || '').trim()));
  if (target) target.click();
})();`

const resultReadyJS = `(function(){
  const text = (document.body && document.body.innerText || '').toLowerCase();
  return text.includes('resultado de consulta')
    || text.includes('estado del documento')
    || text.includes('estado del dte')
    || text.includes('documentos relacionados')
    || text.includes('no encontrado')
    || text.includes('no existe');
})();`
