package reports

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/facturacion/reports/dto"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) Export(c *fiber.Ctx) error {
	var req dto.ExportRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	result, err := ct.service.Export(c.Params("format"), req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	c.Set("Content-Type", result.ContentType)
	c.Set("Content-Disposition", `attachment; filename="`+result.FileName+`"`)
	return c.Send(result.Body)
}
