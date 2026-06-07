package queries

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/modules/facturacion/queries/dto"
)

const defaultBatchConcurrency = 4

type Service struct {
	cfg    config.Config
	client *http.Client
}

func NewService(cfg config.Config) *Service {
	return &Service{
		cfg: cfg,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *Service) ConsultaIndividual(ctx context.Context, req dto.HaciendaQueryRequest, token string) ([]byte, int, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, fiber.StatusUnauthorized, errors.New("token de Hacienda requerido")
	}

	body, err := s.buildIndividualPayload(req)
	if err != nil {
		return nil, fiber.StatusBadRequest, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.individualURL(req.Environment), bytes.NewReader(body))
	if err != nil {
		return nil, fiber.StatusInternalServerError, err
	}
	s.setHeaders(httpReq, token)

	return s.do(httpReq)
}

func (s *Service) ConsultaIndividualBatch(ctx context.Context, req dto.HaciendaBatchQueryRequest, token string) (dto.HaciendaBatchQueryResponse, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return dto.HaciendaBatchQueryResponse{}, errors.New("token de Hacienda requerido")
	}
	if len(req.Items) == 0 {
		return dto.HaciendaBatchQueryResponse{}, errors.New("items requerido")
	}

	resultados := make([]dto.HaciendaQueryResult, len(req.Items))
	var wg sync.WaitGroup
	sem := make(chan struct{}, defaultBatchConcurrency)

	for i := range req.Items {
		req.Items[i].Environment = firstNonEmpty(req.Items[i].Environment, req.Environment)
		resultados[i] = dto.HaciendaQueryResult{
			Index:            i,
			CodigoGeneracion: normalizedCodigoGeneracion(req.Items[i]),
			Status:           "pending",
		}

		wg.Add(1)
		sem <- struct{}{}
		go func(index int) {
			defer wg.Done()
			defer func() { <-sem }()

			body, status, err := s.ConsultaIndividual(ctx, req.Items[index], token)
			resultados[index].HTTPStatus = status
			if err != nil {
				resultados[index].Status = "error"
				resultados[index].Error = err.Error()
				return
			}

			resultados[index].HaciendaResponse = decodeResponse(body)
			if status >= 200 && status < 300 {
				resultados[index].Status = "ok"
				return
			}
			resultados[index].Status = "error"
			resultados[index].Error = fmt.Sprintf("Hacienda respondio HTTP %d", status)
		}(i)
	}

	wg.Wait()

	return dto.HaciendaBatchQueryResponse{
		Total:      len(resultados),
		Resultados: resultados,
	}, nil
}

func (s *Service) ConsultaLote(ctx context.Context, req dto.HaciendaLoteQueryRequest, token string) ([]byte, int, error) {
	token = strings.TrimSpace(token)
	codigoLote := strings.TrimSpace(req.CodigoLote)
	if token == "" {
		return nil, fiber.StatusUnauthorized, errors.New("token de Hacienda requerido")
	}
	if codigoLote == "" {
		return nil, fiber.StatusBadRequest, errors.New("codigoLote requerido")
	}

	url := strings.TrimRight(s.loteURL(req.Environment), "/") + "/" + codigoLote
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fiber.StatusInternalServerError, err
	}
	s.setHeaders(httpReq, token)

	return s.do(httpReq)
}

func (s *Service) buildIndividualPayload(req dto.HaciendaQueryRequest) ([]byte, error) {
	if len(bytes.TrimSpace(req.Payload)) > 0 {
		if !json.Valid(req.Payload) {
			return nil, errors.New("payload invalido")
		}
		return req.Payload, nil
	}

	ambiente := firstNonEmpty(req.Ambiente, ambienteFromEnvironment(req.Environment, s.cfg.HaciendaEnvironment))
	codigoGeneracion := normalizedCodigoGeneracion(req)
	nitEmisor := strings.TrimSpace(req.NITEmisor)
	tipoDTE := firstNonEmpty(req.TipoDTE, req.TDTE)

	if codigoGeneracion == "" {
		return nil, errors.New("codigoGeneracion requerido")
	}
	if nitEmisor == "" {
		return nil, errors.New("nitEmisor requerido")
	}
	if tipoDTE == "" {
		return nil, errors.New("tipoDte requerido")
	}

	payload := map[string]any{
		"ambiente":         ambiente,
		"codigoGeneracion": codigoGeneracion,
		"nitEmisor":        nitEmisor,
		"tipoDte":          tipoDTE,
	}

	if sello := firstNonEmpty(req.SelloRecepcion, req.SelloRecibido); sello != "" {
		payload["selloRecepcion"] = sello
	}

	return json.Marshal(payload)
}

func (s *Service) do(req *http.Request) ([]byte, int, error) {
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

func (s *Service) setHeaders(req *http.Request, token string) {
	req.Header.Set("Authorization", token)
	req.Header.Set("User-Agent", s.cfg.HaciendaUserAgent)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
}

func (s *Service) individualURL(environment string) string {
	if isProduction(environment, s.cfg.HaciendaEnvironment) {
		return s.cfg.HaciendaConsultaDteProd
	}
	return s.cfg.HaciendaConsultaDteTest
}

func (s *Service) loteURL(environment string) string {
	if isProduction(environment, s.cfg.HaciendaEnvironment) {
		return s.cfg.HaciendaConsultaDteLoteProd
	}
	return s.cfg.HaciendaConsultaDteLoteTest
}

func decodeResponse(body []byte) any {
	var payload any
	if err := json.Unmarshal(body, &payload); err != nil {
		return string(body)
	}
	return payload
}

func normalizedCodigoGeneracion(req dto.HaciendaQueryRequest) string {
	return strings.ToUpper(strings.TrimSpace(firstNonEmpty(req.CodigoGeneracion, req.CodGen)))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
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
