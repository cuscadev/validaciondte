package transmissions

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
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
	token = normalizeHaciendaToken(token)
	if token == "" {
		return nil, fiber.StatusUnauthorized, errors.New("token de Hacienda requerido")
	}

	body, err := s.buildPayload(req)
	if err != nil {
		return nil, fiber.StatusBadRequest, err
	}

	// DEBUG LOGGING
	fmt.Printf("[DEBUG-TRANSMIT-DTE] ====================================\n")
	fmt.Printf("[DEBUG-TRANSMIT-DTE] Token length: %d\n", len(token))
	fmt.Printf("[DEBUG-TRANSMIT-DTE] Token prefix: %s\n", token[:min(50, len(token))])
	fmt.Printf("[DEBUG-TRANSMIT-DTE] Token has 'Bearer ': %v\n", strings.HasPrefix(token, "Bearer "))
	fmt.Printf("[DEBUG-TRANSMIT-DTE] Environment: %s\n", req.Environment)
	fmt.Printf("[DEBUG-TRANSMIT-DTE] Ambiente: %s\n", req.Ambiente)
	fmt.Printf("[DEBUG-TRANSMIT-DTE] TipoDTE: %s\n", req.TipoDTE)
	fmt.Printf("[DEBUG-TRANSMIT-DTE] Payload size: %d bytes\n", len(body))
	fmt.Printf("[DEBUG-TRANSMIT-DTE] URL: %s\n", s.url(req.Environment))

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.url(req.Environment), bytes.NewReader(body))
	if err != nil {
		fmt.Printf("[DEBUG-TRANSMIT-DTE] Error creating request: %v\n", err)
		return nil, fiber.StatusInternalServerError, err
	}

	httpReq.Header.Set("Authorization", haciendaAuthorizationHeader(token))
	httpReq.Header.Set("User-Agent", s.cfg.HaciendaUserAgent)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	fmt.Printf("[DEBUG-TRANSMIT-DTE] Headers set:\n")
	fmt.Printf("[DEBUG-TRANSMIT-DTE]   Authorization: Bearer %s...\n", token[:min(30, len(token))])
	fmt.Printf("[DEBUG-TRANSMIT-DTE]   User-Agent: %s\n", s.cfg.HaciendaUserAgent)
	fmt.Printf("[DEBUG-TRANSMIT-DTE]   Content-Type: application/json\n")

	res, err := s.client.Do(httpReq)
	if err != nil {
		fmt.Printf("[DEBUG-TRANSMIT-DTE] Network error: %v\n", err)
		return nil, fiber.StatusBadGateway, err
	}
	defer res.Body.Close()

	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		fmt.Printf("[DEBUG-TRANSMIT-DTE] Error reading response: %v\n", err)
		return nil, fiber.StatusBadGateway, err
	}

	fmt.Printf("[DEBUG-TRANSMIT-DTE] Response Status: %d\n", res.StatusCode)
	fmt.Printf("[DEBUG-TRANSMIT-DTE] Response size: %d bytes\n", len(respBody))
	fmt.Printf("[DEBUG-TRANSMIT-DTE] Response body: %s\n", string(respBody[:min(500, len(respBody))]))
	fmt.Printf("[DEBUG-TRANSMIT-DTE] ====================================\n")

	return respBody, res.StatusCode, nil
}

func (s *Service) TransmitLote(ctx context.Context, req dto.TransmitLoteRequest, token string) ([]byte, int, error) {
	token = normalizeHaciendaToken(token)
	if token == "" {
		return nil, fiber.StatusUnauthorized, errors.New("token de Hacienda requerido")
	}
	if err := validateJWTExpiry(token); err != nil {
		return nil, fiber.StatusUnauthorized, err
	}

	body, err := s.buildLotePayload(req)
	if err != nil {
		return nil, fiber.StatusBadRequest, err
	}

	// DETAILED LOGGING
	fmt.Printf("\n[LOTE-TRANSMIT] =====================================\n")
	fmt.Printf("[LOTE-TRANSMIT] TOKEN CHECK:\n")
	fmt.Printf("[LOTE-TRANSMIT]   Length: %d chars\n", len(token))
	fmt.Printf("[LOTE-TRANSMIT]   Prefix: %.50s\n", token)
	fmt.Printf("[LOTE-TRANSMIT]   Valid JWT: %v\n", strings.HasPrefix(token, "eyJ"))
	fmt.Printf("[LOTE-TRANSMIT]   Expires at: %s\n", jwtExpirySummary(token))
	fmt.Printf("[LOTE-TRANSMIT] REQUEST DATA:\n")
	fmt.Printf("[LOTE-TRANSMIT]   Environment: %s\n", req.Environment)
	fmt.Printf("[LOTE-TRANSMIT]   Ambiente: %s\n", req.Ambiente)
	fmt.Printf("[LOTE-TRANSMIT]   NIT Emisor: %s\n", req.NitEmisor)
	fmt.Printf("[LOTE-TRANSMIT]   Documentos: %d\n", len(req.Documentos))
	fmt.Printf("[LOTE-TRANSMIT]   URL: %s\n", s.loteURL(req.Environment))
	fmt.Printf("[LOTE-TRANSMIT]   Payload size: %d bytes\n", len(body))

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.loteURL(req.Environment), bytes.NewReader(body))
	if err != nil {
		fmt.Printf("[LOTE-TRANSMIT] ERROR creating request: %v\n", err)
		fmt.Printf("[LOTE-TRANSMIT] =====================================\n\n")
		return nil, fiber.StatusInternalServerError, err
	}

	httpReq.Header.Set("Authorization", haciendaAuthorizationHeader(token))
	httpReq.Header.Set("User-Agent", s.cfg.HaciendaUserAgent)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	fmt.Printf("[LOTE-TRANSMIT] HEADERS SENT:\n")
	fmt.Printf("[LOTE-TRANSMIT]   Authorization: Bearer %.40s...\n", token)
	fmt.Printf("[LOTE-TRANSMIT]   User-Agent: %s\n", s.cfg.HaciendaUserAgent)
	fmt.Printf("[LOTE-TRANSMIT]   Content-Type: application/json\n")
	fmt.Printf("[LOTE-TRANSMIT] SENDING REQUEST...\n")

	res, err := s.client.Do(httpReq)
	if err != nil {
		fmt.Printf("[LOTE-TRANSMIT] NETWORK ERROR: %v\n", err)
		fmt.Printf("[LOTE-TRANSMIT] =====================================\n\n")
		return nil, fiber.StatusBadGateway, err
	}
	defer res.Body.Close()

	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		fmt.Printf("[LOTE-TRANSMIT] ERROR reading response: %v\n", err)
		fmt.Printf("[LOTE-TRANSMIT] =====================================\n\n")
		return nil, fiber.StatusBadGateway, err
	}

	fmt.Printf("[LOTE-TRANSMIT] RESPONSE RECEIVED:\n")
	fmt.Printf("[LOTE-TRANSMIT]   Status: %d\n", res.StatusCode)
	fmt.Printf("[LOTE-TRANSMIT]   Headers: %v\n", res.Header)
	fmt.Printf("[LOTE-TRANSMIT]   Body (%d bytes):\n", len(respBody))
	fmt.Printf("[LOTE-TRANSMIT]   %s\n", string(respBody))
	fmt.Printf("[LOTE-TRANSMIT] =====================================\n\n")

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

	documentos := make([]string, 0, len(req.Documentos))
	for index, document := range req.Documentos {
		firma := strings.TrimSpace(document.Documento)
		if firma == "" {
			return nil, errors.New("documentos[" + toString(index) + "].documento firmado es requerido")
		}
		documentos = append(documentos, firma)
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

func normalizeHaciendaToken(token string) string {
	token = strings.TrimSpace(token)
	if strings.HasPrefix(strings.ToLower(token), "bearer ") {
		return strings.TrimSpace(token[7:])
	}
	return token
}

func haciendaAuthorizationHeader(token string) string {
	token = normalizeHaciendaToken(token)
	if token == "" {
		return ""
	}
	return "Bearer " + token
}

func validateJWTExpiry(token string) error {
	expiresAt, ok := jwtExpiry(token)
	if !ok {
		return nil
	}
	if time.Now().After(expiresAt.Add(-30 * time.Second)) {
		return fmt.Errorf("token de Hacienda expirado el %s", expiresAt.Format(time.RFC3339))
	}
	return nil
}

func jwtExpirySummary(token string) string {
	expiresAt, ok := jwtExpiry(token)
	if !ok {
		return "no disponible"
	}
	return expiresAt.Format(time.RFC3339)
}

func jwtExpiry(token string) (time.Time, bool) {
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return time.Time{}, false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return time.Time{}, false
	}
	var claims struct {
		Exp int64 `json:"exp"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil || claims.Exp <= 0 {
		return time.Time{}, false
	}
	return time.Unix(claims.Exp, 0), true
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
