package events

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"verificador-dte/go-dte-api/internal/common/config"
)

type EventRequest struct {
	Ambiente           string          `json:"ambiente"`
	Motivo             string          `json:"motivo"`
	TipoInvalidacion   string          `json:"tipoInvalidacion"`
	CodigoGeneracion   string          `json:"codigoGeneracion"`
	NumeroControl      string          `json:"numeroControl"`
	TipoDTE            string          `json:"tipoDte"`
	SelloRecepcion     string          `json:"selloRecepcion"`
	FechaEmision       string          `json:"fechaEmision"`
	NombreResponsable  string          `json:"nombreResponsable"`
	TipoDocResponsable string          `json:"tipoDocResponsable"`
	NumDocResponsable  string          `json:"numDocResponsable"`
	Payload            json.RawMessage `json:"payload"`
}

type EventResponse struct {
	Success          bool            `json:"success"`
	EventType        string          `json:"eventType"`
	CodigoGeneracion string          `json:"codigoGeneracion"`
	DTEJSON          json.RawMessage `json:"dteJson"`
}

type Service struct {
	cfg config.Config
}

func NewService(cfg config.Config) *Service {
	return &Service{cfg: cfg}
}

func (s *Service) buildEvent(eventType string, req EventRequest) (EventResponse, error) {
	if len(req.Payload) > 0 {
		return EventResponse{
			Success:          true,
			EventType:        eventType,
			CodigoGeneracion: uuid.NewString(),
			DTEJSON:          req.Payload,
		}, nil
	}

	ambiente := strings.TrimSpace(req.Ambiente)
	if ambiente == "" {
		ambiente = "00"
	}
	codigoGeneracion := uuid.NewString()
	now := time.Now()
	fecha := now.Format("2006-01-02")
	hora := now.Format("15:04:05")

	var document map[string]any
	switch eventType {
	case "invalidation":
		if strings.TrimSpace(req.CodigoGeneracion) == "" {
			return EventResponse{}, errors.New("codigoGeneracion del DTE original es requerido")
		}
		document = map[string]any{
			"identificacion": map[string]any{
				"version":          2,
				"ambiente":         ambiente,
				"codigoGeneracion": codigoGeneracion,
				"fecAnula":         fecha,
				"horAnula":         hora,
			},
			"emisor": map[string]any{},
			"documento": map[string]any{
				"tipoDte":              req.TipoDTE,
				"codigoGeneracion":     req.CodigoGeneracion,
				"selloRecibido":        req.SelloRecepcion,
				"numeroControl":        req.NumeroControl,
				"fecEmi":               req.FechaEmision,
				"motivoAnulacion":      req.Motivo,
				"nombreResponsable":    req.NombreResponsable,
				"tipoDocResponsable":   req.TipoDocResponsable,
				"numDocResponsable":    req.NumDocResponsable,
				"nombreSolicita":       req.NombreResponsable,
				"tipoDocSolicita":      req.TipoDocResponsable,
				"numDocSolicita":       req.NumDocResponsable,
				"tipoAnulacion":        defaultString(req.TipoInvalidacion, "02"),
			},
		}
	case "contingency":
		document = map[string]any{
			"identificacion": map[string]any{
				"version":          3,
				"ambiente":         ambiente,
				"codigoGeneracion": codigoGeneracion,
				"fTransmision":     fecha,
				"hTransmision":     hora,
			},
			"emisor": map[string]any{},
			"detalleDTE": []any{},
			"motivo": map[string]any{
				"fInicio": fecha,
				"fFin":    fecha,
				"hInicio": hora,
				"hFin":    hora,
				"tipoContingencia": 1,
				"motivoContingencia": req.Motivo,
			},
		}
	case "special-operations", "return":
		document = map[string]any{
			"identificacion": map[string]any{
				"version":          1,
				"ambiente":         ambiente,
				"codigoGeneracion": codigoGeneracion,
				"fecEvento":        fecha,
				"horEvento":        hora,
			},
			"emisor": map[string]any{},
			"detalle": []any{},
			"observaciones": req.Motivo,
		}
	default:
		return EventResponse{}, errors.New("tipo de evento no soportado")
	}

	raw, err := json.Marshal(document)
	if err != nil {
		return EventResponse{}, err
	}
	return EventResponse{
		Success:          true,
		EventType:        eventType,
		CodigoGeneracion: codigoGeneracion,
		DTEJSON:          raw,
	}, nil
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) Invalidation(c *fiber.Ctx) error {
	return ct.handle(c, "invalidation")
}

func (ct *Controller) Contingency(c *fiber.Ctx) error {
	return ct.handle(c, "contingency")
}

func (ct *Controller) SpecialOperations(c *fiber.Ctx) error {
	return ct.handle(c, "special-operations")
}

func (ct *Controller) Return(c *fiber.Ctx) error {
	return ct.handle(c, "return")
}

func (ct *Controller) handle(c *fiber.Ctx, eventType string) error {
	var req EventRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	resp, err := ct.service.buildEvent(eventType, req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(resp)
}

func Register(router fiber.Router, cfg config.Config) {
	service := NewService(cfg)
	controller := NewController(service)
	submitService := NewSubmitService(cfg)
	submitController := NewSubmitController(submitService)
	group := router.Group("/events")
	group.Post("/invalidation", controller.Invalidation)
	group.Post("/invalidation/submit", submitController.Invalidation)
	group.Post("/contingency", controller.Contingency)
	group.Post("/contingency/submit", submitController.Contingency)
	group.Post("/special-operations", controller.SpecialOperations)
	group.Post("/special-operations/submit", submitController.SpecialOperations)
	group.Post("/return", controller.Return)
	group.Post("/return/submit", submitController.Return)
}
