package schema

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type ValidateRequest struct {
	TipoDTE string          `json:"tipoDte"`
	DTEJSON json.RawMessage `json:"dteJson"`
}

type ValidateResponse struct {
	Success bool     `json:"success"`
	TipoDTE string   `json:"tipoDte"`
	Errors  []string `json:"errors,omitempty"`
}

type Service struct{}

func NewService() *Service {
	return &Service{}
}

func (s *Service) Validate(req ValidateRequest) (ValidateResponse, error) {
	tipoDte := strings.TrimSpace(req.TipoDTE)
	if len(bytesTrim(req.DTEJSON)) == 0 {
		return ValidateResponse{}, errors.New("dteJson es requerido")
	}

	var body map[string]any
	if err := json.Unmarshal(req.DTEJSON, &body); err != nil {
		return ValidateResponse{}, errors.New("dteJson invalido")
	}

	errorsList := validateWithSvfeSchema(tipoDte, body)
	return ValidateResponse{
		Success: len(errorsList) == 0,
		TipoDTE: tipoDte,
		Errors:  errorsList,
	}, nil
}

func bytesTrim(raw json.RawMessage) []byte {
	return []byte(strings.TrimSpace(string(raw)))
}

func validateStructure(tipoDte string, body map[string]any) []string {
	required := []string{"identificacion", "emisor", "resumen"}
	if tipoDte == "01" || tipoDte == "03" || tipoDte == "11" || tipoDte == "14" {
		required = append(required, "receptor", "cuerpoDocumento")
	}
	var missing []string
	for _, key := range required {
		if _, ok := body[key]; !ok {
			missing = append(missing, key+" es requerido")
		}
	}
	if ident, ok := body["identificacion"].(map[string]any); ok {
		for _, key := range []string{"version", "ambiente", "tipoDte", "numeroControl", "codigoGeneracion"} {
			if _, exists := ident[key]; !exists {
				missing = append(missing, "identificacion."+key+" es requerido")
			}
		}
		if tipoDte != "" {
			if value, _ := ident["tipoDte"].(string); value != "" && value != tipoDte {
				missing = append(missing, "identificacion.tipoDte no coincide")
			}
		}
	}
	return missing
}

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) Validate(c *fiber.Ctx) error {
	var req ValidateRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	if req.TipoDTE == "" {
		req.TipoDTE = c.Params("tipoDte")
	}
	resp, err := ct.service.Validate(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	if !resp.Success {
		return c.Status(fiber.StatusBadRequest).JSON(resp)
	}
	return c.JSON(resp)
}

func Register(router fiber.Router) {
	service := NewService()
	controller := NewController(service)
	group := router.Group("/schema")
	group.Post("/validate", controller.Validate)
	group.Post("/validate/:tipoDte", controller.Validate)
}
