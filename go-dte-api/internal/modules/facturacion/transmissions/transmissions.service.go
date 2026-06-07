package transmissions

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/modules/facturacion/transmissions/dto"
)

type Service struct {
	cfg    config.Config
	client *http.Client
}

func NewService(cfg config.Config) *Service {
	return &Service{
		cfg: cfg,
		client: &http.Client{
			Timeout: 45 * time.Second,
		},
	}
}

func (s *Service) TransmitDTE(ctx context.Context, req dto.TransmitDTERequest, token string) ([]byte, int, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, fiber.StatusUnauthorized, errors.New("token de Hacienda requerido")
	}

	body, err := s.buildPayload(req)
	if err != nil {
		return nil, fiber.StatusBadRequest, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.url(req.Environment), bytes.NewReader(body))
	if err != nil {
		return nil, fiber.StatusInternalServerError, err
	}

	httpReq.Header.Set("Authorization", token)
	httpReq.Header.Set("User-Agent", s.cfg.HaciendaUserAgent)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	res, err := s.client.Do(httpReq)
	if err != nil {
		return nil, fiber.StatusBadGateway, err
	}
	defer res.Body.Close()

	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fiber.StatusBadGateway, err
	}

	return respBody, res.StatusCode, nil
}

func (s *Service) TransmitLote(ctx context.Context, req dto.TransmitLoteRequest, token string) ([]byte, int, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, fiber.StatusUnauthorized, errors.New("token de Hacienda requerido")
	}

	body, err := s.buildLotePayload(req)
	if err != nil {
		return nil, fiber.StatusBadRequest, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.loteURL(req.Environment), bytes.NewReader(body))
	if err != nil {
		return nil, fiber.StatusInternalServerError, err
	}

	httpReq.Header.Set("Authorization", token)
	httpReq.Header.Set("User-Agent", s.cfg.HaciendaUserAgent)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	res, err := s.client.Do(httpReq)
	if err != nil {
		return nil, fiber.StatusBadGateway, err
	}
	defer res.Body.Close()

	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fiber.StatusBadGateway, err
	}

	return respBody, res.StatusCode, nil
}

func (s *Service) buildPayload(req dto.TransmitDTERequest) ([]byte, error) {
	if len(bytes.TrimSpace(req.Payload)) > 0 {
		if !json.Valid(req.Payload) {
			return nil, errors.New("payload invalido")
		}
		return req.Payload, nil
	}

	ambiente := strings.TrimSpace(req.Ambiente)
	if ambiente == "" {
		ambiente = ambienteFromEnvironment(req.Environment, s.cfg.HaciendaEnvironment)
	}
	if req.Version <= 0 {
		return nil, errors.New("version es requerida")
	}
	if strings.TrimSpace(req.TipoDTE) == "" {
		return nil, errors.New("tipoDte es requerido")
	}
	if strings.TrimSpace(req.Documento) == "" {
		return nil, errors.New("documento firmado es requerido")
	}

	idEnvio := req.IDEnvio
	if idEnvio == nil || strings.TrimSpace(toString(idEnvio)) == "" {
		idEnvio = 1
	}

	return json.Marshal(map[string]any{
		"ambiente":  ambiente,
		"idEnvio":   idEnvio,
		"version":   req.Version,
		"tipoDte":   strings.TrimSpace(req.TipoDTE),
		"documento": strings.TrimSpace(req.Documento),
	})
}

func (s *Service) buildLotePayload(req dto.TransmitLoteRequest) ([]byte, error) {
	if len(bytes.TrimSpace(req.Payload)) > 0 {
		if !json.Valid(req.Payload) {
			return nil, errors.New("payload invalido")
		}
		return req.Payload, nil
	}

	ambiente := strings.TrimSpace(req.Ambiente)
	if ambiente == "" {
		ambiente = ambienteFromEnvironment(req.Environment, s.cfg.HaciendaEnvironment)
	}
	if req.Version <= 0 {
		return nil, errors.New("version es requerida")
	}
	nitEmisor := strings.TrimSpace(firstNonEmpty(req.NitEmisor, req.NitEmi))
	if nitEmisor == "" {
		return nil, errors.New("nitEmisor es requerido")
	}
	if len(req.Documentos) < 2 || len(req.Documentos) > 100 {
		return nil, errors.New("documentos debe contener entre 2 y 100 elementos")
	}

	documentos := make([]map[string]any, 0, len(req.Documentos))
	for index, document := range req.Documentos {
		tipoDTE := strings.TrimSpace(document.TipoDTE)
		codigoGeneracion := strings.TrimSpace(document.CodigoGeneracion)
		firma := strings.TrimSpace(document.Documento)
		if tipoDTE == "" {
			return nil, errors.New("documentos[" + toString(index) + "].tipoDte es requerido")
		}
		if document.Version <= 0 {
			return nil, errors.New("documentos[" + toString(index) + "].version es requerido")
		}
		if codigoGeneracion == "" {
			return nil, errors.New("documentos[" + toString(index) + "].codigoGeneracion es requerido")
		}
		if firma == "" {
			return nil, errors.New("documentos[" + toString(index) + "].documento firmado es requerido")
		}
		documentos = append(documentos, map[string]any{
			"tipoDte":          tipoDTE,
			"version":          document.Version,
			"codigoGeneracion": codigoGeneracion,
			"documento":        firma,
		})
	}

	idEnvio := req.IDEnvio
	if idEnvio == nil || strings.TrimSpace(toString(idEnvio)) == "" {
		return nil, errors.New("idEnvio es requerido")
	}

	return json.Marshal(map[string]any{
		"ambiente":   ambiente,
		"idEnvio":    strings.TrimSpace(toString(idEnvio)),
		"version":    req.Version,
		"nitEmisor":  nitEmisor,
		"documentos": documentos,
	})
}

func (s *Service) url(environment string) string {
	if isProduction(environment, s.cfg.HaciendaEnvironment) {
		return s.cfg.HaciendaRecepcionDteProd
	}
	return s.cfg.HaciendaRecepcionDteTest
}

func (s *Service) loteURL(environment string) string {
	if isProduction(environment, s.cfg.HaciendaEnvironment) {
		return s.cfg.HaciendaRecepcionLoteProd
	}
	return s.cfg.HaciendaRecepcionLoteTest
}

func ambienteFromEnvironment(environment string, fallback string) string {
	if isProduction(environment, fallback) {
		return "01"
	}
	return "00"
}

func isProduction(environment string, fallback string) bool {
	env := strings.ToLower(strings.TrimSpace(firstNonEmpty(environment, fallback)))
	return env == "prod" || env == "production" || env == "01"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func toString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return strings.TrimRight(strings.TrimRight(strings.TrimSpace(jsonNumber(typed)), "0"), ".")
	default:
		raw, _ := json.Marshal(typed)
		return string(raw)
	}
}

func jsonNumber(value float64) string {
	raw, _ := json.Marshal(value)
	return string(raw)
}
