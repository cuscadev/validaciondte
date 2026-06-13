package email_documents

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/email_documents/dto"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) Lookup(c *fiber.Ctx) error {
	organizationID := c.Query("organizationId")
	messageID := c.Query("messageId")
	attachmentID := c.Query("attachmentId")
	contentHash := c.Query("contentHash")

	if organizationID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "organizationId es obligatorio")
	}

	ctx := c.Context()
	if messageID != "" && attachmentID != "" {
		doc, err := ct.service.FindByMessageAttachment(ctx, organizationID, messageID, attachmentID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{"document": doc})
	}
	if contentHash != "" {
		doc, err := ct.service.FindByHash(ctx, organizationID, contentHash)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{"document": doc})
	}
	return fiber.NewError(fiber.StatusBadRequest, "Indica messageId+attachmentId o contentHash")
}

func (ct *Controller) BatchLookup(c *fiber.Ctx) error {
	var req dto.BatchLookupRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	payload, err := ct.service.BatchLookup(c.Context(), req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(payload)
}

func (ct *Controller) Record(c *fiber.Ctx) error {
	var req dto.RecordDocumentRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	doc, err := ct.service.Record(c.Context(), req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"document": doc})
}

func (ct *Controller) List(c *fiber.Ctx) error {
	var q dto.ListDocumentsQuery
	if err := c.QueryParser(&q); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	docs, total, err := ct.service.List(c.Context(), q)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(fiber.Map{"documents": docs, "total": total})
}

func (ct *Controller) ListImported(c *fiber.Ctx) error {
	organizationID := c.Query("organizationId")
	if organizationID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "organizationId es obligatorio")
	}
	docs, err := ct.service.ListImported(c.Context(), organizationID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(fiber.Map{"documents": docs})
}

func (ct *Controller) GetByID(c *fiber.Ctx) error {
	organizationID := c.Query("organizationId")
	documentID := c.Params("id")
	if organizationID == "" || documentID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "organizationId e id son obligatorios")
	}
	doc, err := ct.service.GetByID(c.Context(), organizationID, documentID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(fiber.Map{"document": doc})
}

func (ct *Controller) RawJSON(c *fiber.Ctx) error {
	organizationID := c.Query("organizationId")
	documentID := c.Params("id")
	if organizationID == "" || documentID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "organizationId e id son obligatorios")
	}
	raw, err := ct.service.RawJSON(c.Context(), organizationID, documentID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	c.Set("Content-Type", "application/json; charset=utf-8")
	return c.SendString(raw)
}

func (ct *Controller) Links(c *fiber.Ctx) error {
	organizationID := c.Query("organizationId")
	documentID := c.Params("id")
	if organizationID == "" || documentID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "organizationId e id son obligatorios")
	}
	payload, err := ct.service.LinkedDocuments(c.Context(), organizationID, documentID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(payload)
}

func (ct *Controller) ByIDs(c *fiber.Ctx) error {
	var req dto.ByIDsRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	if req.OrganizationID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "organizationId es obligatorio")
	}
	docs, err := ct.service.GetByIDs(c.Context(), req.OrganizationID, req.IDs)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(fiber.Map{"documents": docs})
}

func (ct *Controller) UpsertLink(c *fiber.Ctx) error {
	var req dto.UpsertLinkRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	if err := ct.service.UpsertLink(c.Context(), req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(fiber.Map{"ok": true})
}
