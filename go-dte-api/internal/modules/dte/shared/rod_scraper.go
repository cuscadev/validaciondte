package shared

import (
	"context"
	"net/url"
	"strings"
	"time"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/launcher"
	"github.com/go-rod/rod/lib/proto"
)

type RodScraper struct {
	browser *rod.Browser
}

func NewRodScraper(parent context.Context) (*RodScraper, error) {
	path, _ := launcher.LookPath()
	l := launcher.New().Headless(true).Set("disable-gpu").Set("no-sandbox")
	if path != "" {
		l = l.Bin(path)
	}
	controlURL, err := l.Launch()
	if err != nil {
		return nil, err
	}

	browser := rod.New().ControlURL(controlURL)
	if err := browser.Connect(); err != nil {
		return nil, err
	}

	return &RodScraper{browser: browser}, nil
}

func (r *RodScraper) Close() {
	if r != nil && r.browser != nil {
		r.browser.Close()
	}
}

func (r *RodScraper) ConsultarDTE(parent context.Context, rawURL string) Result {
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

	page, err := r.browser.Page(proto.TargetCreateTarget{URL: "about:blank"})
	if err != nil {
		result.Error = err.Error()
		return result
	}
	defer page.Close()

	_ = page.SetUserAgent(&proto.NetworkSetUserAgentOverride{
		UserAgent: "Mozilla/5.0 VerificadorDTE-Go/1.0 Chrome Safari",
	})

	router := page.HijackRequests()
	defer router.Stop()

	router.MustAdd("*", func(ctx *rod.Hijack) {
		resourceType := ctx.Request.Type()
		switch resourceType {
		case proto.NetworkResourceTypeImage, proto.NetworkResourceTypeMedia,
			proto.NetworkResourceTypeFont, proto.NetworkResourceTypeStylesheet:
			ctx.Response.Fail(proto.NetworkErrorReasonBlockedByClient)
			return
		}
		ctx.ContinueRequest(&proto.FetchContinueRequest{})
	})
	go router.Run()

	if err := page.Context(parent).Navigate(sanitized); err != nil {
		result.Error = err.Error()
		return result
	}

	if err := page.WaitLoad(); err != nil {
		result.Error = err.Error()
		return result
	}

	_, _ = page.Eval(clickSearchButtonJS)

	if err := rodWaitForScrapeReady(page, parent); err != nil {
		result.Error = err.Error()
		return result
	}

	html, err := page.HTML()
	if err != nil {
		result.Error = err.Error()
		return result
	}

	return MapHTMLResult(html, result)
}

func rodWaitForScrapeReady(page *rod.Page, parent context.Context) error {
	deadline := time.Now().Add(12 * time.Second)
	basicSeen := false
	for time.Now().Before(deadline) {
		select {
		case <-parent.Done():
			return parent.Err()
		default:
		}

		val, err := page.Eval(scrapeReadyJS)
		if err != nil {
			return err
		}
		if val.Value.Bool() {
			time.Sleep(150 * time.Millisecond)
			return nil
		}

		bodyVal, err := page.Eval(`(document.body && document.body.innerText) || ""`)
		if err == nil && scrapeReadyBasic(bodyVal.Value.Str()) {
			basicSeen = true
		}

		interval := 150 * time.Millisecond
		if basicSeen {
			interval = 80 * time.Millisecond
		}
		time.Sleep(interval)
	}
	return errScrapeNotReady
}
