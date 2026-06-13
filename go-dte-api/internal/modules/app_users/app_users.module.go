package app_users

import (
	"log"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/common/db"
	emaildocuments "verificador-dte/go-dte-api/internal/modules/email_documents"
)

func Register(app *fiber.App, cfg config.Config) {
	if !db.Enabled() {
		log.Printf("warn: app_users deshabilitado (SUPABASE_DB_URL no configurada)")
		return
	}

	store := NewStore(db.Pool())
	service := NewService(store)
	controller := NewController(service)

	api := app.Group("/api", emaildocuments.InternalAuthMiddleware(cfg.InternalAPIKey))
	users := api.Group("/app-users")

	users.Post("/bulk", controller.BulkUpsert)
	users.Put("/:id", controller.Upsert)
	users.Get("/:id", controller.GetByID)
	users.Delete("/:id", controller.Delete)
}
