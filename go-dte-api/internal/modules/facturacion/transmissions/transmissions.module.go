package transmissions

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
)

func Register(router fiber.Router, cfg config.Config) {
	service := NewService(cfg)
	controller := NewController(service)

	transmissions := router.Group("/transmissions")
	transmissions.Post("/dte", controller.TransmitDTE)
	transmissions.Post("/lote", controller.TransmitLote)
	transmissions.Get("/debug", controller.DebugEnvironment)
}
