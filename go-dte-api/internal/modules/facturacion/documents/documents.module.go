package documents

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/facturacion/catalogs"
)

func Register(router fiber.Router, catalogService *catalogs.Service) {
	service := NewService(catalogService)
	controller := NewController(service)

	documents := router.Group("/documents")
	documents.Post("/preview", controller.PreviewDocument)
	documents.Post("/factura-consumidor-final", controller.CreateConsumerInvoice)
	documents.Post("/credito-fiscal", controller.CreateTaxCreditInvoice)
	documents.Post("/nota-credito", controller.CreateCreditNote)
	documents.Post("/nota-debito", controller.CreateDebitNote)
	documents.Post("/sujeto-excluido", controller.CreateExcludedSubjectInvoice)
}
