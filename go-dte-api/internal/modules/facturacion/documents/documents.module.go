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
	documents.Post("/factura-exportacion", controller.CreateExportInvoice)
	documents.Post("/sujeto-excluido", controller.CreateExcludedSubjectInvoice)
	documents.Post("/nota-remision", controller.CreateNotaRemision)
	documents.Post("/comprobante-retencion", controller.CreateComprobanteRetencion)
	documents.Post("/comprobante-liquidacion", controller.CreateComprobanteLiquidacion)
	documents.Post("/documento-contable-liquidacion", controller.CreateDocumentoContableLiquidacion)
	documents.Post("/comprobante-donacion", controller.CreateComprobanteDonacion)
}
