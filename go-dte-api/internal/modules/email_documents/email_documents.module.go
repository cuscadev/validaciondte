package email_documents

import (
	"log"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/common/db"
)

func Register(app *fiber.App, cfg config.Config) {
	if !db.Enabled() {
		log.Printf("warn: email_documents deshabilitado (SUPABASE_DB_URL no configurada)")
		return
	}

	store := NewStore(db.Pool())
	service := NewService(store)
	controller := NewController(service)

	api := app.Group("/api", InternalAuthMiddleware(cfg.InternalAPIKey))
	docs := api.Group("/email-documents")

	docs.Get("/lookup", controller.Lookup)
	docs.Post("/lookup-batch", controller.BatchLookup)
	docs.Post("/", controller.Record)
	docs.Get("/", controller.List)
	docs.Get("/imported", controller.ListImported)
	docs.Post("/by-ids", controller.ByIDs)
	docs.Get("/:id", controller.GetByID)
	docs.Get("/:id/raw", controller.RawJSON)
	docs.Get("/:id/links", controller.Links)

	links := api.Group("/email-document-links")
	links.Post("/", controller.UpsertLink)
}
