package procesarjson

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/modules/dte/procesar_json/dto"
	"verificador-dte/go-dte-api/internal/modules/dte/shared"
)

type Service struct {
	cfg config.Config
}

type jsonRow struct {
	CodGen   string
	FechaYMD string
}

func NewService(cfg config.Config) *Service {
	return &Service{cfg: cfg}
}

func (s *Service) ProcessFiles(c *fiber.Ctx) (shared.ProcessResponse, error) {
	form, err := c.MultipartForm()
	if err != nil {
		return shared.ProcessResponse{}, errors.New("no se proporcionaron archivos JSON")
	}

	files := append(form.File["files"], form.File["file"]...)
	if len(files) == 0 {
		return shared.ProcessResponse{}, errors.New("no se proporcionaron archivos JSON")
	}

	rows := []jsonRow{}
	extrasByKey := map[string]shared.Result{}
	parseErrors := []shared.Result{}

	for _, header := range files {
		opened, err := header.Open()
		if err != nil {
			continue
		}
		data, readErr := io.ReadAll(opened)
		_ = opened.Close()
		if readErr != nil {
			continue
		}

		items := robustJSONParse(data)
		extracted := jsonItemsToRows(items, extrasByKey)
		if len(extracted) == 0 {
			parseErrors = append(parseErrors, shared.Result{
				Visitar:      "Abrir",
				Estado:       "ERROR",
				TipoDteNorm:  "SIN_TIPO",
				Relacionados: []shared.RelatedDocument{},
				Error:        "No se encontraron campos identificacion.codigoGeneracion / identificacion.fecEmi validos en el JSON.",
			})
			continue
		}
		rows = append(rows, extracted...)
	}

	rows = dedupeJSONRows(rows)
	if len(rows) == 0 && len(parseErrors) > 0 {
		return shared.ProcessResponse{Total: len(parseErrors), Resultados: parseErrors}, nil
	}
	if len(rows) == 0 {
		return shared.ProcessResponse{}, errors.New("no se encontraron filas validas")
	}

	links := make([]string, 0, len(rows))
	for _, row := range rows {
		links = append(links, shared.BuildConsultaURL(row.CodGen, row.FechaYMD, "01"))
	}

	results := shared.ProcessBatchWithOptions(c.Context(), links, shared.BatchOptionsFromConfig(s.cfg, s.cfg.Concurrency))
	for idx := range results {
		key := shared.ResultLookupKey(results[idx].CodGen, results[idx].FechaEmi)
		if extra, ok := extrasByKey[key]; ok {
			shared.MergeJSONIntoResult(&results[idx], extra)
		}
	}

	results = append(parseErrors, results...)
	return shared.ProcessResponse{
		Total:      len(results),
		Resultados: results,
	}, nil
}

func (s *Service) Process(ctx context.Context, req dto.ProcessJSONRequest) (shared.ProcessResponse, error) {
	items := req.Items
	if len(items) == 0 && strings.TrimSpace(req.PasteText) != "" {
		items = pastedToDTO(shared.ParsePastedItems(req.PasteText))
	}

	items = dedupeItems(items)
	if len(items) == 0 {
		return shared.ProcessResponse{}, errors.New("sin items para verificar")
	}
	if len(items) > shared.MaxItems {
		return shared.ProcessResponse{}, fmt.Errorf("maximo permitido: %d items", shared.MaxItems)
	}

	type resolvedItem struct {
		codGen   string
		fechaYMD string
	}
	resolved := make([]resolvedItem, 0, len(items))
	for _, item := range items {
		codGen := strings.ToUpper(strings.TrimSpace(item.CodGen))
		if !shared.IsUUID(codGen) {
			return shared.ProcessResponse{}, errors.New("datos invalidos: use codGen UUID")
		}
		fechaYMD, ok := resolveProcessItemDate(item)
		if !ok {
			return shared.ProcessResponse{}, errors.New("datos invalidos: use fecha dd/mm/yyyy o fechaYmd yyyy-mm-dd")
		}
		resolved = append(resolved, resolvedItem{codGen: codGen, fechaYMD: fechaYMD})
	}

	ambiente := "01"
	if req.Ambiente == "00" {
		ambiente = "00"
	}

	concurrency := req.Concurrencia
	if concurrency <= 0 {
		concurrency = s.cfg.Concurrency
	}
	if concurrency > 12 {
		concurrency = 12
	}

	links := make([]string, 0, len(resolved))
	for _, item := range resolved {
		links = append(links, shared.BuildConsultaURL(item.codGen, item.fechaYMD, ambiente))
	}

	enrichNC := req.EnrichCreditNotes
	if shouldAsyncBatch(s.cfg, req.Async, len(links)) {
		jobID, err := shared.EnqueueBatchJob(shared.BatchJobPayload{
			Links:             links,
			Concurrency:       concurrency,
			EnrichCreditNotes: enrichNC,
			IncludeExcel:      req.IncludeExcel,
		})
		if err != nil {
			return shared.ProcessResponse{}, err
		}
		return shared.ProcessResponse{
			JobID:  jobID,
			Status: "pending",
			Total:  len(links),
			Done:   0,
		}, nil
	}

	opts := shared.BatchOptions{
		Concurrency:       concurrency,
		EnrichCreditNotes: enrichNC,
	}
	results := shared.ProcessBatchWithOptions(ctx, links, opts)
	return buildResponse(results, req.IncludeExcel)
}

func shouldAsyncBatch(cfg config.Config, async bool, count int) bool {
	if !cfg.RedisEnabled {
		return false
	}
	return async || count > cfg.AsyncBatchThreshold
}

func buildResponse(results []shared.Result, includeExcel bool) (shared.ProcessResponse, error) {
	resp := shared.ProcessResponse{
		Total:      len(results),
		Resultados: results,
	}

	if includeExcel {
		excelBase64, err := shared.BuildExcelBase64(results)
		if err != nil {
			return shared.ProcessResponse{}, err
		}
		resp.Filename = fmt.Sprintf("resultados_dtes_%d.xlsx", time.Now().UnixMilli())
		resp.ExcelBase64 = excelBase64
	}

	return resp, nil
}

func pastedToDTO(items []shared.PastedItem) []dto.ProcessItem {
	out := make([]dto.ProcessItem, 0, len(items))
	for _, item := range items {
		out = append(out, dto.ProcessItem{CodGen: item.CodGen, Fecha: item.Fecha})
	}
	return out
}

func dedupeItems(items []dto.ProcessItem) []dto.ProcessItem {
	seen := map[string]bool{}
	out := []dto.ProcessItem{}
	for _, item := range items {
		cod := strings.ToUpper(strings.TrimSpace(item.CodGen))
		if cod == "" {
			continue
		}
		fechaYMD, ok := resolveProcessItemDate(item)
		if !ok {
			continue
		}
		key := cod + "|" + fechaYMD
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, dto.ProcessItem{
			CodGen:   cod,
			FechaYmd: fechaYMD,
		})
	}
	return out
}

func resolveProcessItemDate(item dto.ProcessItem) (string, bool) {
	if ymd := strings.TrimSpace(item.FechaYmd); ymd != "" {
		return shared.TryParseFechaFlexible(ymd)
	}
	if shared.IsDMY(item.Fecha) {
		return shared.DMYToYMD(item.Fecha), true
	}
	if ymd, ok := shared.TryParseFechaFlexible(strings.TrimSpace(item.Fecha)); ok {
		return ymd, true
	}
	return "", false
}

func robustJSONParse(data []byte) []map[string]any {
	var raw any
	if err := json.Unmarshal(data, &raw); err == nil {
		switch typed := raw.(type) {
		case []any:
			out := make([]map[string]any, 0, len(typed))
			for _, item := range typed {
				if obj, ok := item.(map[string]any); ok {
					out = append(out, obj)
				}
			}
			return out
		case map[string]any:
			return []map[string]any{typed}
		}
	}

	out := []map[string]any{}
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var obj map[string]any
		if err := json.Unmarshal([]byte(line), &obj); err == nil {
			out = append(out, obj)
		}
	}
	return out
}

func jsonItemsToRows(items []map[string]any, extrasByKey map[string]shared.Result) []jsonRow {
	rows := []jsonRow{}
	for _, item := range items {
		ident := jsonAsMap(item["identificacion"])
		codGen := strings.ToUpper(strings.TrimSpace(jsonAsString(ident["codigoGeneracion"])))
		fechaYMD := shared.NormalizeJSONDate(jsonAsString(ident["fecEmi"]))
		if !shared.IsUUID(codGen) || fechaYMD == "" {
			continue
		}

		key := shared.ResultLookupKey(codGen, fechaYMD)
		extrasByKey[key] = shared.ExtractDTEJSONFields(item)
		rows = append(rows, jsonRow{CodGen: codGen, FechaYMD: fechaYMD})
	}
	return rows
}

func dedupeJSONRows(rows []jsonRow) []jsonRow {
	seen := map[string]bool{}
	out := []jsonRow{}
	for _, row := range rows {
		key := shared.ResultLookupKey(row.CodGen, row.FechaYMD)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, row)
	}
	return out
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
		return fmt.Sprintf("%.0f", typed)
	case nil:
		return ""
	default:
		return fmt.Sprint(typed)
	}
}
