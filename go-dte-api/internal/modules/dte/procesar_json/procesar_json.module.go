package procesarjson

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
)

func Register(api fiber.Router, dte fiber.Router, cfg config.Config) {
	service := NewService(cfg)
	controller := NewController(service)

	dte.Post("/process-items", controller.Process)
	dte.Post("/process-json", controller.Process)
	dte.Post("/process-json-files", controller.ProcessFiles)

	// Alias compatible con el route actual de Next.js.
	api.Post("/procesaedte", controller.Process)
	api.Post("/verificararchjson", controller.ProcessFiles)
}
