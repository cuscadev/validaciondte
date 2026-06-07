package documents

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/facturacion/documents/dto"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) CreateConsumerInvoice(c *fiber.Ctx) error {
	var req dto.CreateConsumerInvoiceRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, err := ct.service.CreateConsumerInvoice(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(resp)
}

func (ct *Controller) PreviewDocument(c *fiber.Ctx) error {
	var req dto.PreviewDocumentRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, err := ct.service.PreviewDocument(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(resp)
}

func (ct *Controller) CreateTaxCreditInvoice(c *fiber.Ctx) error {
	var req dto.CreateTaxCreditInvoiceRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, err := ct.service.CreateTaxCreditInvoice(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(resp)
}

func (ct *Controller) CreateCreditNote(c *fiber.Ctx) error {
	var req dto.CreateAdjustmentNoteRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, err := ct.service.CreateCreditNote(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(resp)
}

func (ct *Controller) CreateDebitNote(c *fiber.Ctx) error {
	var req dto.CreateAdjustmentNoteRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, err := ct.service.CreateDebitNote(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(resp)
}

func (ct *Controller) CreateExcludedSubjectInvoice(c *fiber.Ctx) error {
	var req dto.CreateExcludedSubjectInvoiceRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	resp, err := ct.service.CreateExcludedSubjectInvoice(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(resp)
}
