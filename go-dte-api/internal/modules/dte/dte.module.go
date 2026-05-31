package dte

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
	procesararchivos "verificador-dte/go-dte-api/internal/modules/dte/procesar_archivos"
	procesarjson "verificador-dte/go-dte-api/internal/modules/dte/procesar_json"
	"verificador-dte/go-dte-api/internal/modules/dte/jobs"
)

func Register(app *fiber.App, cfg config.Config) {
	api := app.Group("/api")
	dte := api.Group("/dte")

	procesararchivos.Register(api, dte, cfg)
	procesarjson.Register(api, dte, cfg)
	jobs.Register(dte)
}
