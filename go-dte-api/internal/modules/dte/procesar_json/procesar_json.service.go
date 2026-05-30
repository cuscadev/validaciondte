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

type jsonExtra struct {
	EmisorNit             string `json:"emisorNit,omitempty"`
	EmisorNrc             string `json:"emisorNrc,omitempty"`
	EmisorNombre          string `json:"emisorNombre,omitempty"`
	EmisorCodActividad    string `json:"emisorCodActividad,omitempty"`
	EmisorDescActividad   string `json:"emisorDescActividad,omitempty"`
	EmisorNombreComercial string `json:"emisorNombreComercial,omitempty"`
	EmisorTelefono        string `json:"emisorTelefono,omitempty"`
	EmisorCorreo          string `json:"emisorCorreo,omitempty"`

	ReceptorNit             string `json:"receptorNit,omitempty"`
	ReceptorNrc             string `json:"receptorNrc,omitempty"`
	ReceptorNombre          string `json:"receptorNombre,omitempty"`
	ReceptorCodActividad    string `json:"receptorCodActividad,omitempty"`
	ReceptorDescActividad   string `json:"receptorDescActividad,omitempty"`
	ReceptorDepartamento    string `json:"receptorDepartamento,omitempty"`
	ReceptorMunicipio       string `json:"receptorMunicipio,omitempty"`
	ReceptorComplemento     string `json:"receptorComplemento,omitempty"`
	ReceptorTelefono        string `json:"receptorTelefono,omitempty"`
	ReceptorCorreo          string `json:"receptorCorreo,omitempty"`
	ReceptorNombreComercial string `json:"receptorNombreComercial,omitempty"`
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
	extrasByKey := map[string]jsonExtra{}
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

	results := shared.ProcessLinks(c.Context(), links, s.cfg.Concurrency)
	for idx := range results {
		key := results[idx].CodGen + "|" + results[idx].FechaEmi
		applyJSONExtra(&results[idx], extrasByKey[key])
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

	for _, item := range items {
		if !shared.IsUUID(item.CodGen) || !shared.IsDMY(item.Fecha) {
			return shared.ProcessResponse{}, errors.New("datos invalidos: use codGen UUID y fecha dd/mm/yyyy")
		}
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

	links := make([]string, 0, len(items))
	for _, item := range items {
		links = append(links, shared.BuildConsultaURL(item.CodGen, shared.DMYToYMD(item.Fecha), ambiente))
	}

	results := shared.ProcessLinks(ctx, links, concurrency)
	return buildResponse(results, req.IncludeExcel)
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
		fecha := strings.TrimSpace(item.Fecha)
		key := cod + "|" + fecha
		if cod == "" || fecha == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, dto.ProcessItem{CodGen: cod, Fecha: fecha})
	}
	return out
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

func jsonItemsToRows(items []map[string]any, extrasByKey map[string]jsonExtra) []jsonRow {
	rows := []jsonRow{}
	for _, item := range items {
		ident := asMap(item["identificacion"])
		codGen := strings.ToUpper(strings.TrimSpace(asString(ident["codigoGeneracion"])))
		fechaYMD := normalizeJSONDate(asString(ident["fecEmi"]))
		if !shared.IsUUID(codGen) || fechaYMD == "" {
			continue
		}

		key := codGen + "|" + fechaYMD
		extrasByKey[key] = extractExtra(item)
		rows = append(rows, jsonRow{CodGen: codGen, FechaYMD: fechaYMD})
	}
	return rows
}

func normalizeJSONDate(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if len(raw) >= 10 {
		raw = raw[:10]
	}
	normalized := shared.NormalizarFecha(raw)
	if len(normalized) == 10 && normalized[4] == '-' && normalized[7] == '-' {
		return normalized
	}
	return ""
}

func extractExtra(item map[string]any) jsonExtra {
	emisor := asMap(item["emisor"])
	receptor := asMap(item["receptor"])
	direccion := asMap(receptor["direccion"])

	return jsonExtra{
		EmisorNit:             asString(emisor["nit"]),
		EmisorNrc:             asString(emisor["nrc"]),
		EmisorNombre:          asString(emisor["nombre"]),
		EmisorCodActividad:    asString(emisor["codActividad"]),
		EmisorDescActividad:   asString(emisor["descActividad"]),
		EmisorNombreComercial: asString(emisor["nombreComercial"]),
		EmisorTelefono:        asString(emisor["telefono"]),
		EmisorCorreo:          asString(emisor["correo"]),

		ReceptorNit:             asString(receptor["nit"]),
		ReceptorNrc:             asString(receptor["nrc"]),
		ReceptorNombre:          asString(receptor["nombre"]),
		ReceptorCodActividad:    asString(receptor["codActividad"]),
		ReceptorDescActividad:   asString(receptor["descActividad"]),
		ReceptorDepartamento:    asString(direccion["departamento"]),
		ReceptorMunicipio:       asString(direccion["municipio"]),
		ReceptorComplemento:     asString(direccion["complemento"]),
		ReceptorTelefono:        asString(receptor["telefono"]),
		ReceptorCorreo:          asString(receptor["correo"]),
		ReceptorNombreComercial: asString(receptor["nombreComercial"]),
	}
}

func applyJSONExtra(result *shared.Result, extra jsonExtra) {
	result.EmisorNit = extra.EmisorNit
	result.EmisorNrc = extra.EmisorNrc
	result.EmisorNombre = extra.EmisorNombre
	result.EmisorCodActividad = extra.EmisorCodActividad
	result.EmisorDescActividad = extra.EmisorDescActividad
	result.EmisorNombreComercial = extra.EmisorNombreComercial
	result.EmisorTelefono = extra.EmisorTelefono
	result.EmisorCorreo = extra.EmisorCorreo
	result.ReceptorNit = extra.ReceptorNit
	result.ReceptorNrc = extra.ReceptorNrc
	result.ReceptorNombre = extra.ReceptorNombre
	result.ReceptorCodActividad = extra.ReceptorCodActividad
	result.ReceptorDescActividad = extra.ReceptorDescActividad
	result.ReceptorDepartamento = extra.ReceptorDepartamento
	result.ReceptorMunicipio = extra.ReceptorMunicipio
	result.ReceptorComplemento = extra.ReceptorComplemento
	result.ReceptorTelefono = extra.ReceptorTelefono
	result.ReceptorCorreo = extra.ReceptorCorreo
	result.ReceptorNombreComercial = extra.ReceptorNombreComercial
}

func dedupeJSONRows(rows []jsonRow) []jsonRow {
	seen := map[string]bool{}
	out := []jsonRow{}
	for _, row := range rows {
		key := row.CodGen + "|" + row.FechaYMD
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, row)
	}
	return out
}

func asMap(value any) map[string]any {
	if typed, ok := value.(map[string]any); ok {
		return typed
	}
	return map[string]any{}
}

func asString(value any) string {
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
