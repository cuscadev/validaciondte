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

	seen := map[string]bool{}
	var links []string

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

		for _, row := range shared.ParseCodFechaFromFile(header.Filename, data) {
			key := row.CodGen + "|" + row.FechaYMD
			if seen[key] {
				continue
			}
			seen[key] = true
			links = append(links, shared.BuildConsultaURL(row.CodGen, row.FechaYMD, "01"))
		}
	}

	if len(links) == 0 {
		return shared.ProcessResponse{}, errors.New(
			"no se encontraron filas validas. Se espera CSV/XLSX con columnas: codGen,fecha (yyyy-MM-dd o dd/MM/yyyy)",
		)
	}

	results := shared.ProcessBatchWithOptions(c.Context(), links, shared.BatchOptionsFromConfig(s.cfg, s.cfg.Concurrency))
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

	seen := map[string]bool{}
	var links []string

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

		for _, link := range shared.ParseLinksFromFile(header.Filename, data) {
			sanitized := shared.SanitizarURL(link)
			if sanitized == "" || seen[sanitized] {
				continue
			}
			seen[sanitized] = true
			links = append(links, sanitized)
		}
	}

	if len(links) == 0 {
		return shared.ProcessResponse{}, errors.New("no se encontraron URLs validas en los archivos")
	}

	results := shared.ProcessBatchWithOptions(c.Context(), links, shared.BatchOptionsFromConfig(s.cfg, s.cfg.Concurrency))
	return buildResponse(results, true)
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
