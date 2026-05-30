package hacienda

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
)

type Service struct {
	cfg    config.Config
	client *http.Client
}

type LoteJSONResponse struct {
	Total      int              `json:"total"`
	Resultados []LoteJSONResult `json:"resultados"`
}

type LoteJSONResult struct {
	CodigoLote string `json:"codigoLote"`
	Origen     string `json:"origen,omitempty"`
	Status     string `json:"status"`
	Error      string `json:"error,omitempty"`
	Response   any    `json:"response,omitempty"`
}

func NewService(cfg config.Config) *Service {
	return &Service{
		cfg: cfg,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *Service) ConsultaDteLote(ctx context.Context, codigoLote string, token string, environment string) ([]byte, int, error) {
	codigoLote = strings.TrimSpace(codigoLote)
	token = strings.TrimSpace(token)

	if codigoLote == "" {
		return nil, fiber.StatusBadRequest, errors.New("codigoLote requerido")
	}
	if token == "" {
		return nil, fiber.StatusUnauthorized, errors.New("token de Hacienda requerido")
	}

	url := strings.TrimRight(s.baseURL(environment), "/") + "/" + codigoLote
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fiber.StatusInternalServerError, err
	}

	req.Header.Set("Authorization", token)
	req.Header.Set("User-Agent", s.cfg.HaciendaUserAgent)
	req.Header.Set("Content-Type", "application/JSON")

	res, err := s.client.Do(req)
	if err != nil {
		return nil, fiber.StatusBadGateway, err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fiber.StatusBadGateway, err
	}

	return body, res.StatusCode, nil
}

func (s *Service) ConsultaDteLoteJSON(c *fiber.Ctx, token string, environment string) (LoteJSONResponse, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return LoteJSONResponse{}, errors.New("token de Hacienda requerido")
	}

	form, err := c.MultipartForm()
	if err != nil {
		return LoteJSONResponse{}, errors.New("no se proporcionaron archivos JSON")
	}

	files := append(form.File["files"], form.File["file"]...)
	if len(files) == 0 {
		return LoteJSONResponse{}, errors.New("no se proporcionaron archivos JSON")
	}

	codigos := map[string]string{}
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

		for codigo, origen := range extractCodigosConsultaLote(data) {
			if _, exists := codigos[codigo]; !exists {
				codigos[codigo] = origen
			}
		}
	}

	if len(codigos) == 0 {
		return LoteJSONResponse{}, errors.New("no se encontro codigoLote ni identificacion.codigoGeneracion en los JSON")
	}

	resultados := make([]LoteJSONResult, 0, len(codigos))
	for codigo, origen := range codigos {
		resultados = append(resultados, LoteJSONResult{
			CodigoLote: codigo,
			Origen:     origen,
			Status:     "pending",
		})
	}

	const concurrency = 4
	var wg sync.WaitGroup
	sem := make(chan struct{}, concurrency)

	for i := range resultados {
		wg.Add(1)
		sem <- struct{}{}

		go func(index int) {
			defer wg.Done()
			defer func() { <-sem }()

			body, status, err := s.ConsultaDteLote(context.Background(), resultados[index].CodigoLote, token, environment)
			if err != nil {
				resultados[index].Status = "error"
				resultados[index].Error = err.Error()
				return
			}

			var payload any
			if unmarshalErr := json.Unmarshal(body, &payload); unmarshalErr != nil {
				payload = string(body)
			}

			resultados[index].Response = payload
			if status >= 200 && status < 300 {
				resultados[index].Status = "ok"
				return
			}

			resultados[index].Status = "error"
			resultados[index].Error = fmt.Sprintf("Hacienda respondio HTTP %d", status)
		}(i)
	}

	wg.Wait()

	return LoteJSONResponse{
		Total:      len(resultados),
		Resultados: resultados,
	}, nil
}

func (s *Service) baseURL(environment string) string {
	env := strings.TrimSpace(environment)
	if env == "" {
		env = s.cfg.HaciendaEnvironment
	}
	if env == "production" {
		return s.cfg.HaciendaConsultaDteLoteProd
	}
	return s.cfg.HaciendaConsultaDteLoteTest
}

func extractCodigosConsultaLote(data []byte) map[string]string {
	out := map[string]string{}
	var raw any
	if err := json.Unmarshal(data, &raw); err == nil {
		collectCodigosConsultaLote(raw, out, false)
		return out
	}

	for _, match := range regexp.MustCompile(`(?i)"?(codigoGeneracion|codigo[\s_-]*lote|cod[\s_-]*lote)"?\s*:\s*"([A-Za-z0-9_-]{6,})"`).FindAllSubmatch(data, -1) {
		key := normalizeJSONKey(string(match[1]))
		origen := "codigoLote"
		if key == "codigogeneracion" {
			origen = "codigoGeneracion"
		}
		addCodigoConsultaLote(string(match[2]), origen, out)
	}

	return out
}

func collectCodigosConsultaLote(value any, out map[string]string, insideLote bool) {
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			collectCodigosConsultaLote(item, out, insideLote)
		}
	case map[string]any:
		for key, raw := range typed {
			normalized := normalizeJSONKey(key)
			keyLooksLikeLote := strings.Contains(normalized, "lote") && !strings.Contains(normalized, "cantidad")

			switch {
			case normalized == "codigogeneracion":
				addCodigoConsultaLote(asString(raw), "codigoGeneracion", out)
			case isLoteCodeKey(normalized):
				addCodigoConsultaLote(asString(raw), "codigoLote", out)
			case keyLooksLikeLote && !isObjectLike(raw):
				addCodigoConsultaLote(asString(raw), "codigoLote", out)
			case insideLote && isGenericCodeKey(normalized):
				addCodigoConsultaLote(asString(raw), "codigoLote", out)
			}

			collectCodigosConsultaLote(raw, out, insideLote || keyLooksLikeLote || isLoteCodeKey(normalized))
		}
	case string:
		if strings.HasPrefix(strings.TrimSpace(typed), "{") || strings.HasPrefix(strings.TrimSpace(typed), "[") {
			var nested any
			if err := json.Unmarshal([]byte(typed), &nested); err == nil {
				collectCodigosConsultaLote(nested, out, insideLote)
			}
		}
	}
}

func addCodigoConsultaLote(raw string, origen string, out map[string]string) {
	value := strings.ToUpper(strings.TrimSpace(raw))
	if value == "" {
		return
	}
	out[value] = origen
}

func normalizeJSONKey(key string) string {
	key = strings.ToLower(key)
	replacer := strings.NewReplacer("_", "", "-", "", " ", "", ".", "")
	return replacer.Replace(key)
}

func isLoteCodeKey(key string) bool {
	switch key {
	case "codigolote", "codlote", "idlote", "loteid", "numerolote", "numlote":
		return true
	default:
		return false
	}
}

func isGenericCodeKey(key string) bool {
	switch key {
	case "codigo", "code", "id", "numero", "num", "valor", "value":
		return true
	default:
		return false
	}
}

func isObjectLike(value any) bool {
	switch value.(type) {
	case []any, map[string]any:
		return true
	default:
		return false
	}
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
