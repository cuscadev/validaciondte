package jobs

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/dte/shared"
)

type Controller struct{}

func NewController() *Controller {
	return &Controller{}
}

func (ct *Controller) Get(c *fiber.Ctx) error {
	jobID := c.Params("id")
	status, ok := shared.GetBatchJob(jobID)
	if !ok {
		return fiber.NewError(fiber.StatusNotFound, "job no encontrado")
	}
	return c.JSON(status)
}
