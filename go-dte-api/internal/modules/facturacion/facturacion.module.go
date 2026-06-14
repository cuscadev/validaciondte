package facturacion

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
	httpmiddleware "verificador-dte/go-dte-api/internal/common/http"
	"verificador-dte/go-dte-api/internal/modules/facturacion/catalogs"
	certificates "verificador-dte/go-dte-api/internal/modules/facturacion/certificates"
	"verificador-dte/go-dte-api/internal/modules/facturacion/auth"
	"verificador-dte/go-dte-api/internal/modules/facturacion/events"
	"verificador-dte/go-dte-api/internal/modules/facturacion/deliveries"
	"verificador-dte/go-dte-api/internal/modules/facturacion/documents"
	"verificador-dte/go-dte-api/internal/modules/facturacion/items"
	"verificador-dte/go-dte-api/internal/modules/facturacion/queries"
	"verificador-dte/go-dte-api/internal/modules/facturacion/receptors"
	"verificador-dte/go-dte-api/internal/modules/facturacion/reports"
	"verificador-dte/go-dte-api/internal/modules/facturacion/schema"
	"verificador-dte/go-dte-api/internal/modules/facturacion/sequences"
	"verificador-dte/go-dte-api/internal/modules/facturacion/signer"
	"verificador-dte/go-dte-api/internal/modules/facturacion/transmissions"
)

func Register(app *fiber.App, cfg config.Config) {
	api := app.Group("/api")
	facturacion := api.Group("/facturacion", httpmiddleware.InternalAuthMiddleware(cfg.InternalAPIKey))

	catalogService := catalogs.NewService(cfg)
	catalogs.Register(facturacion, catalogService)
	certificates.Register(facturacion, cfg)
	auth.Register(facturacion, cfg)
	schema.Register(facturacion)
	sequences.Register(facturacion, cfg)
	events.Register(facturacion, cfg)
	receptors.Register(facturacion, catalogService)
	items.Register(facturacion, catalogService)
	documents.Register(facturacion, catalogService)
	deliveries.Register(facturacion)
	reports.Register(facturacion)
	queries.Register(facturacion, cfg)
	transmissions.Register(facturacion, cfg)
	signer.Register(facturacion, cfg)
}
