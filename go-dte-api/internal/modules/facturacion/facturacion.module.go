package facturacion

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/modules/facturacion/catalogs"
	"verificador-dte/go-dte-api/internal/modules/facturacion/deliveries"
	"verificador-dte/go-dte-api/internal/modules/facturacion/documents"
	"verificador-dte/go-dte-api/internal/modules/facturacion/items"
	"verificador-dte/go-dte-api/internal/modules/facturacion/queries"
	"verificador-dte/go-dte-api/internal/modules/facturacion/receptors"
	"verificador-dte/go-dte-api/internal/modules/facturacion/reports"
	"verificador-dte/go-dte-api/internal/modules/facturacion/signer"
	"verificador-dte/go-dte-api/internal/modules/facturacion/transmissions"
)

func Register(app *fiber.App, cfg config.Config) {
	api := app.Group("/api")
	facturacion := api.Group("/facturacion")

	catalogService := catalogs.NewService(cfg)
	catalogs.Register(facturacion, catalogService)
	receptors.Register(facturacion, catalogService)
	items.Register(facturacion, catalogService)
	documents.Register(facturacion, catalogService)
	deliveries.Register(facturacion)
	reports.Register(facturacion)
	queries.Register(facturacion, cfg)
	transmissions.Register(facturacion, cfg)
	signer.Register(facturacion, cfg)
}
