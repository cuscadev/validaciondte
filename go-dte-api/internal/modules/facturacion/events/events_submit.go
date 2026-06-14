package events

import (
	"encoding/json"
	"strings"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
	signer "verificador-dte/go-dte-api/internal/modules/facturacion/signer"
	signerdto "verificador-dte/go-dte-api/internal/modules/facturacion/signer/dto"
	"verificador-dte/go-dte-api/internal/modules/facturacion/transmissions"
	transmissionsdto "verificador-dte/go-dte-api/internal/modules/facturacion/transmissions/dto"
)

type SubmitRequest struct {
	EventRequest
	NIT           string `json:"nit"`
	PasswordPri   string `json:"passwordPri"`
	Environment   string `json:"environment"`
	Transmit      *bool  `json:"transmit"`
	TipoDTE       string `json:"tipoDte"`
	Authorization string `json:"-"`
}

type SubmitResponse struct {
	Success          bool            `json:"success"`
	EventType        string          `json:"eventType"`
	CodigoGeneracion string          `json:"codigoGeneracion"`
	DTEJSON          json.RawMessage `json:"dteJson"`
	Firma            string          `json:"firma,omitempty"`
	HaciendaResponse json.RawMessage `json:"haciendaResponse,omitempty"`
	SelloRecepcion   string          `json:"selloRecepcion,omitempty"`
}

type SubmitService struct {
	events        *Service
	signer        *signer.Service
	transmissions *transmissions.Service
}

func NewSubmitService(cfg config.Config) *SubmitService {
	return &SubmitService{
		events:        NewService(cfg),
		signer:        signer.NewService(cfg),
		transmissions: transmissions.NewService(cfg),
	}
}

func (s *SubmitService) Submit(c *fiber.Ctx, eventType string, req SubmitRequest) (SubmitResponse, error) {
	built, err := s.events.buildEvent(eventType, req.EventRequest)
	if err != nil {
		return SubmitResponse{}, err
	}

	nit := strings.TrimSpace(req.NIT)
	if nit == "" {
		return SubmitResponse{}, fiber.NewError(fiber.StatusBadRequest, "nit es requerido")
	}

	firma, err := s.signer.Sign(signerdto.SignRequest{
		NIT:         nit,
		PasswordPri: req.PasswordPri,
		DTEJSON:     built.DTEJSON,
	})
	if err != nil {
		return SubmitResponse{}, err
	}

	response := SubmitResponse{
		Success:          true,
		EventType:        built.EventType,
		CodigoGeneracion: built.CodigoGeneracion,
		DTEJSON:          built.DTEJSON,
		Firma:            firma,
	}

	transmit := req.Transmit == nil || *req.Transmit
	if !transmit {
		return response, nil
	}

	token := strings.TrimSpace(req.Authorization)
	if token == "" {
		token = strings.TrimSpace(c.Get("Authorization"))
	}
	if token == "" {
		return SubmitResponse{}, fiber.NewError(fiber.StatusUnauthorized, "token de Hacienda requerido")
	}

	environment := strings.TrimSpace(req.Environment)
	if environment == "" {
		environment = "test"
	}
	tipoDte := strings.TrimSpace(req.TipoDTE)
	if tipoDte == "" {
		tipoDte = strings.TrimSpace(req.TipoDTE)
	}

	body, status, err := s.transmissions.TransmitDTE(c.Context(), transmissionsdto.TransmitDTERequest{
		Environment: environment,
		Ambiente:    req.Ambiente,
		Documento:   firma,
		TipoDTE:     tipoDte,
	}, token)
	if err != nil {
		return SubmitResponse{}, fiber.NewError(status, err.Error())
	}

	response.HaciendaResponse = body
	response.SelloRecepcion = extractSello(body)
	return response, nil
}

func extractSello(body []byte) string {
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return ""
	}
	for _, key := range []string{"selloRecibido", "selloRecepcion"} {
		if value, ok := payload[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	if nested, ok := payload["body"].(map[string]any); ok {
		for _, key := range []string{"selloRecibido", "selloRecepcion"} {
			if value, ok := nested[key].(string); ok && strings.TrimSpace(value) != "" {
				return strings.TrimSpace(value)
			}
		}
	}
	return ""
}

type SubmitController struct {
	service *SubmitService
}

func NewSubmitController(service *SubmitService) *SubmitController {
	return &SubmitController{service: service}
}

func (ct *SubmitController) handle(c *fiber.Ctx, eventType string) error {
	var req SubmitRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	req.Authorization = c.Get("Authorization")
	resp, err := ct.service.Submit(c, eventType, req)
	if err != nil {
		if fiberErr, ok := err.(*fiber.Error); ok {
			return fiberErr
		}
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(resp)
}

func (ct *SubmitController) Invalidation(c *fiber.Ctx) error {
	return ct.handle(c, "invalidation")
}

func (ct *SubmitController) Contingency(c *fiber.Ctx) error {
	return ct.handle(c, "contingency")
}

func (ct *SubmitController) SpecialOperations(c *fiber.Ctx) error {
	return ct.handle(c, "special-operations")
}

func (ct *SubmitController) Return(c *fiber.Ctx) error {
	return ct.handle(c, "return")
}
