package hacienda

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
)

func Register(app *fiber.App, cfg config.Config) {
	service := NewService(cfg)
	controller := NewController(service)

	api := app.Group("/api")
	api.Get("/hacienda/consulta-dte-lote/:codigoLote", controller.ConsultaDteLote)
	api.Post("/hacienda/consulta-dte-lote-json", controller.ConsultaDteLoteJSON)
}
