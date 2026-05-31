package procesararchivos

import "github.com/gofiber/fiber/v2"

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) Process(c *fiber.Ctx) error {
	resp, err := ct.service.Process(c)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(resp)
}

func (ct *Controller) ProcessCodFecha(c *fiber.Ctx) error {
	resp, err := ct.service.ProcessCodFecha(c)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(resp)
}
