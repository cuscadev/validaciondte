package transmissions

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/facturacion/transmissions/dto"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) TransmitDTE(c *fiber.Ctx) error {
	var req dto.TransmitDTERequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, status, err := ct.service.TransmitDTE(c.Context(), req, c.Get("Authorization"))
	if err != nil {
		return fiber.NewError(status, err.Error())
	}

	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(resp)
}
