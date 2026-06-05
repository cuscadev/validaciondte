package procesararchivos

import (
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"time"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/modules/dte/shared"
)

type Service struct {
	cfg config.Config
}

func NewService(cfg config.Config) *Service {
	return &Service{cfg: cfg}
}

func (s *Service) ProcessCodFecha(c *fiber.Ctx) (shared.ProcessResponse, error) {
	form, err := c.MultipartForm()
	if err != nil {
		return shared.ProcessResponse{}, errors.New("no se proporcionaron archivos")
	}

	files := collectFiles(form.File["files"], form.File["file"])
	if len(files) == 0 {
		return shared.ProcessResponse{}, errors.New("no se proporcionaron archivos")
	}

	entries, fileErrors := collectCodFechaEntries(files)
	if len(entries) == 0 && len(fileErrors) > 0 {
		resp, err := buildResponse(fileErrors, true)
		if err != nil {
			return shared.ProcessResponse{}, err
		}
		resp.Filename = fmt.Sprintf("verificacion_cod_fecha_%d.xlsx", time.Now().UnixMilli())
		return resp, nil
	}
	if len(entries) == 0 {
		return shared.ProcessResponse{}, errors.New(
			"no se encontraron filas validas. Se espera CSV/XLSX con columnas: codGen,fecha (yyyy-MM-dd o dd/MM/yyyy)",
		)
	}

	opts := shared.BatchOptionsFromConfig(s.cfg, s.cfg.Concurrency)
	opts.EnrichCreditNotes = true
	results := shared.ProcessLinkEntriesWithOptions(c.Context(), entries, opts)
	results = append(fileErrors, results...)
	resp, err := buildResponse(results, true)
	if err != nil {
		return shared.ProcessResponse{}, err
	}
	resp.Filename = fmt.Sprintf("verificacion_cod_fecha_%d.xlsx", time.Now().UnixMilli())
	return resp, nil
}

func (s *Service) Process(c *fiber.Ctx) (shared.ProcessResponse, error) {
	form, err := c.MultipartForm()
	if err != nil {
		return shared.ProcessResponse{}, errors.New("no se proporcionaron archivos")
	}

	files := collectFiles(form.File["files"], form.File["file"])
	if len(files) == 0 {
		return shared.ProcessResponse{}, errors.New("no se proporcionaron archivos")
	}

	entries, fileErrors := collectLinkEntries(files)
	if len(entries) == 0 && len(fileErrors) > 0 {
		return buildResponse(fileErrors, true)
	}
	if len(entries) == 0 {
		return shared.ProcessResponse{}, errors.New("no se encontraron URLs validas en los archivos")
	}

	opts := shared.BatchOptionsFromConfig(s.cfg, s.cfg.Concurrency)
	opts.EnrichCreditNotes = true
	results := shared.ProcessLinkEntriesWithOptions(c.Context(), entries, opts)
	results = append(fileErrors, results...)
	return buildResponse(results, true)
}

func collectCodFechaEntries(files []*multipart.FileHeader) ([]shared.LinkEntry, []shared.Result) {
	seen := map[string]bool{}
	entries := []shared.LinkEntry{}
	fileErrors := []shared.Result{}

	for _, header := range files {
		data, ok := readUploadFile(header)
		if !ok {
			fileErrors = append(fileErrors, shared.FileParseErrorResult(
				header.Filename,
				"No se pudo leer el archivo.",
			))
			continue
		}

		rows := shared.ParseCodFechaFromFile(header.Filename, data)
		if len(rows) == 0 {
			fileErrors = append(fileErrors, shared.FileParseErrorResult(
				header.Filename,
				"No se encontraron filas validas. Se espera codGen y fecha (yyyy-MM-dd o dd/MM/yyyy).",
			))
			continue
		}

		for _, row := range rows {
			key := row.CodGen + "|" + row.FechaYMD
			if seen[key] {
				continue
			}
			seen[key] = true
			entries = append(entries, shared.LinkEntry{
				URL:           shared.BuildConsultaURL(row.CodGen, row.FechaYMD, "01"),
				NombreArchivo: row.NombreArchivo,
			})
		}
	}

	return entries, fileErrors
}

func collectLinkEntries(files []*multipart.FileHeader) ([]shared.LinkEntry, []shared.Result) {
	seen := map[string]bool{}
	entries := []shared.LinkEntry{}
	fileErrors := []shared.Result{}

	for _, header := range files {
		data, ok := readUploadFile(header)
		if !ok {
			fileErrors = append(fileErrors, shared.FileParseErrorResult(
				header.Filename,
				"No se pudo leer el archivo.",
			))
			continue
		}

		links := shared.ParseLinksFromFile(header.Filename, data)
		if len(links) == 0 {
			fileErrors = append(fileErrors, shared.FileParseErrorResult(
				header.Filename,
				"No se encontraron URLs validas de consulta DTE en el archivo.",
			))
			continue
		}

		for _, link := range links {
			sanitized := shared.SanitizarURL(link)
			if sanitized == "" || seen[sanitized] {
				continue
			}
			seen[sanitized] = true
			entries = append(entries, shared.LinkEntry{
				URL:           sanitized,
				NombreArchivo: header.Filename,
			})
		}
	}

	return entries, fileErrors
}

func readUploadFile(header *multipart.FileHeader) ([]byte, bool) {
	opened, err := header.Open()
	if err != nil {
		return nil, false
	}
	data, readErr := io.ReadAll(opened)
	_ = opened.Close()
	if readErr != nil {
		return nil, false
	}
	return data, true
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

func collectFiles(groups ...[]*multipart.FileHeader) []*multipart.FileHeader {
	out := []*multipart.FileHeader{}
	for _, group := range groups {
		out = append(out, group...)
	}
	return out
}
