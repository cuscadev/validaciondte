package signer

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/facturacion/signer/dto"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) Sign(c *fiber.Ctx) error {
	var req dto.SignRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	firma, err := ct.service.Sign(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(dto.SignResponse{
		Success: true,
		Firma:   firma,
	})
}

func (ct *Controller) SignBatch(c *fiber.Ctx) error {
	var req dto.SignBatchRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, err := ct.service.SignBatch(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(resp)
}

func (ct *Controller) SignCompat(c *fiber.Ctx) error {
	var req dto.SignRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(dto.CompatResponse{
			Status: "ERROR",
			Code:   "810",
			Error:  "JSON invalido",
		})
	}

	firma, err := ct.service.Sign(req)
	if err != nil {
		return c.JSON(dto.CompatResponse{
			Status: "ERROR",
			Code:   "804",
			Error:  err.Error(),
		})
	}

	return c.JSON(dto.CompatResponse{
		Status: "OK",
		Body:   firma,
	})
}
