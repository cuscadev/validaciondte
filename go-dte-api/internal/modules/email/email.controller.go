package email

import (
	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	service *Service
	apiKey  string
}

func NewController(service *Service, apiKey string) *Controller {
	return &Controller{service: service, apiKey: apiKey}
}

type runSyncRequest struct {
	JobID          string `json:"jobId"`
	OrganizationID string `json:"organizationId"`
	ConnectionID   string `json:"connectionId"`
	DateFrom       string `json:"dateFrom"`
	DateTo         string `json:"dateTo"`
	CreatedByUID   string `json:"createdByUid"`
}

func (c *Controller) RunSync(ctx *fiber.Ctx) error {
	if c.apiKey == "" {
		return ctx.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "GO_DTE_INTERNAL_API_KEY no configurado en go-dte-api",
		})
	}
	if ctx.Get("X-Internal-Api-Key") != c.apiKey {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "No autorizado"})
	}

	var body runSyncRequest
	if err := ctx.BodyParser(&body); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "JSON invalido"})
	}
	if body.JobID == "" || body.OrganizationID == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "jobId y organizationId requeridos"})
	}

	job, err := c.service.RunSyncSync(ctx.UserContext(), RunSyncInput{
		JobID:          body.JobID,
		OrganizationID: body.OrganizationID,
		ConnectionID:   body.ConnectionID,
		DateFrom:       body.DateFrom,
		DateTo:         body.DateTo,
		CreatedByUID:   body.CreatedByUID,
	})
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	status := "completed"
	if job != nil && job.Status != "" {
		status = job.Status
	}

	return ctx.JSON(fiber.Map{
		"ok":     true,
		"jobId":  body.JobID,
		"status": status,
	})
}

func (c *Controller) Health(ctx *fiber.Ctx) error {
	if c.apiKey == "" {
		return ctx.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"ok": false})
	}
	if ctx.Get("X-Internal-Api-Key") != c.apiKey {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "No autorizado"})
	}
	return ctx.JSON(fiber.Map{"ok": true, "module": "email-sync"})
}
