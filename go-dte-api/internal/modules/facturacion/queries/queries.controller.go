package queries

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/facturacion/queries/dto"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) ConsultaIndividual(c *fiber.Ctx) error {
	var req dto.HaciendaQueryRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, status, err := ct.service.ConsultaIndividual(c.Context(), req, c.Get("Authorization"))
	if err != nil {
		return fiber.NewError(status, err.Error())
	}

	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(resp)
}

func (ct *Controller) ConsultaIndividualByCode(c *fiber.Ctx) error {
	req := dto.HaciendaQueryRequest{
		Environment:      c.Query("environment", ""),
		Ambiente:         c.Query("ambiente", ""),
		CodigoGeneracion: c.Params("codigoGeneracion"),
		NITEmisor:        c.Query("nitEmisor", ""),
		TipoDTE:          c.Query("tipoDte", ""),
		SelloRecepcion:   c.Query("selloRecepcion", ""),
	}

	resp, status, err := ct.service.ConsultaIndividual(c.Context(), req, c.Get("Authorization"))
	if err != nil {
		return fiber.NewError(status, err.Error())
	}

	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(resp)
}

func (ct *Controller) ConsultaIndividualBatch(c *fiber.Ctx) error {
	var req dto.HaciendaBatchQueryRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, err := ct.service.ConsultaIndividualBatch(c.Context(), req, c.Get("Authorization"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(resp)
}

func (ct *Controller) ConsultaLote(c *fiber.Ctx) error {
	req := dto.HaciendaLoteQueryRequest{
		Environment: c.Query("environment", ""),
		CodigoLote:  c.Params("codigoLote"),
	}

	resp, status, err := ct.service.ConsultaLote(c.Context(), req, c.Get("Authorization"))
	if err != nil {
		return fiber.NewError(status, err.Error())
	}

	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(resp)
}

func (ct *Controller) ConsultaLoteBody(c *fiber.Ctx) error {
	var req dto.HaciendaLoteQueryRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, status, err := ct.service.ConsultaLote(c.Context(), req, c.Get("Authorization"))
	if err != nil {
		return fiber.NewError(status, err.Error())
	}

	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(resp)
}
