package hacienda

import "github.com/gofiber/fiber/v2"

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) ConsultaDteLote(c *fiber.Ctx) error {
	codigoLote := c.Params("codigoLote")
	token := c.Get("Authorization")
	environment := c.Query("environment", "")

	resp, status, err := ct.service.ConsultaDteLote(c.Context(), codigoLote, token, environment)
	if err != nil {
		return fiber.NewError(status, err.Error())
	}

	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(resp)
}

func (ct *Controller) ConsultaDteLoteJSON(c *fiber.Ctx) error {
	token := c.Get("Authorization")
	environment := c.FormValue("environment", c.Query("environment", ""))

	resp, err := ct.service.ConsultaDteLoteJSON(c, token, environment)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(resp)
}
