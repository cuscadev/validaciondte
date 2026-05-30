package procesararchivos

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
)

func Register(api fiber.Router, dte fiber.Router, cfg config.Config) {
	service := NewService(cfg)
	controller := NewController(service)

	dte.Post("/process-files", controller.Process)

	// Alias compatible con el route actual de Next.js.
	api.Post("/procesar", controller.Process)
}
