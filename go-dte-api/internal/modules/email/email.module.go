package email

import (
	"context"
	"log"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/modules/email/store"
)

func Register(app *fiber.App, cfg config.Config) {
	if cfg.DatabaseURL == "" {
		log.Printf("warn: email sync disabled (SUPABASE_DB_URL/DATABASE_URL missing)")
		return
	}

	pg, err := store.NewPostgresStore(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Printf("warn: email sync disabled: %v", err)
		return
	}

	service := NewService(cfg, pg)
	controller := NewController(service, cfg.InternalAPIKey)

	api := app.Group("/api/email")
	api.Post("/sync/run", controller.RunSync)
	api.Get("/sync/health", controller.Health)
}
