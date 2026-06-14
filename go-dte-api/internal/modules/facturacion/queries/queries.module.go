package queries

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
)

func Register(router fiber.Router, cfg config.Config) {
	service := NewService(cfg)
	controller := NewController(service)

	queries := router.Group("/queries")
	queries.Post("/dte", controller.ConsultaIndividual)
	queries.Get("/dte/:codigoGeneracion", controller.ConsultaIndividualByCode)
	queries.Post("/dte/batch", controller.ConsultaIndividualBatch)
	queries.Get("/lote/:codigoLote", controller.ConsultaLote)
	queries.Post("/lote", controller.ConsultaLoteBody)
}
