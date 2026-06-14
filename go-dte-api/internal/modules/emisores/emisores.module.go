package emisores

import (
	"log"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/common/db"
	emaildocuments "verificador-dte/go-dte-api/internal/modules/email_documents"
)

func Register(app *fiber.App, cfg config.Config) {
	if !db.Enabled() {
		log.Printf("warn: emisores deshabilitado (SUPABASE_DB_URL no configurada)")
		return
	}

	store := NewStore(db.Pool())
	service := NewService(store)
	controller := NewController(service)

	api := app.Group("/api", emaildocuments.InternalAuthMiddleware(cfg.InternalAPIKey))
	group := api.Group("/emisores")
	group.Get("/me", controller.GetMe)
	group.Get("/me/dte-input", controller.GetMeDteInput)
	group.Get("/:id/dte-input", controller.GetDteInput)
}
