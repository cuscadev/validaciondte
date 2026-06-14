package certificates

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/common/db"
)

var sharedService *Service

func Register(router fiber.Router, cfg config.Config) {
	if !db.Enabled() {
		service := NewService(cfg, nil)
		sharedService = service
		registerRoutes(router, service)
		return
	}
	service := NewService(cfg, db.Pool())
	sharedService = service
	registerRoutes(router, service)
}

func registerRoutes(router fiber.Router, service *Service) {
	controller := NewController(service)
	group := router.Group("/certificates")
	group.Post("/upload", controller.Upload)
	group.Post("/warmup", controller.Warmup)
	group.Get("/cached", controller.GetCached)
}

func SharedService() *Service {
	return sharedService
}
