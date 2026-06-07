package items

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/facturacion/items/dto"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) Build(c *fiber.Ctx) error {
	var req dto.BuildItemsRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, err := ct.service.Build(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(resp)
}
