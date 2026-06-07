package deliveries

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/facturacion/deliveries/dto"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) BuildPackage(c *fiber.Ctx) error {
	var req dto.BuildDeliveryRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, err := ct.service.BuildPackage(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(resp)
}

func (ct *Controller) DownloadJSON(c *fiber.Ctx) error {
	var req dto.BuildDeliveryRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, err := ct.service.BuildPackage(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	name := strings.TrimSpace(resp.CodigoGeneracion)
	if name == "" {
		name = "dte-final"
	}
	c.Set("Content-Type", "application/json")
	c.Set("Content-Disposition", `attachment; filename="`+name+`.json"`)
	return c.Send(resp.FinalJSON)
}
