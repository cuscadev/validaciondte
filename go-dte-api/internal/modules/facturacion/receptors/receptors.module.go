package receptors

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/facturacion/catalogs"
)

func Register(router fiber.Router, catalogService *catalogs.Service) {
	service := NewService(catalogService)
	controller := NewController(service)

	router.Post("/receptors/build", controller.Build)
}
