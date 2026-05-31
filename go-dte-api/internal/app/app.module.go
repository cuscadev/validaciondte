package app

import (
	"context"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"

	"verificador-dte/go-dte-api/internal/common/config"
	dtemodule "verificador-dte/go-dte-api/internal/modules/dte"
	"verificador-dte/go-dte-api/internal/modules/dte/shared"
	haciendamodule "verificador-dte/go-dte-api/internal/modules/hacienda"
)

func New(cfg config.Config) *fiber.App {
	if err := shared.InitScrapeRuntime(context.Background(), cfg); err != nil {
		log.Printf("warn: scrape runtime init failed: %v", err)
	}

	app := fiber.New(fiber.Config{
		AppName:      "verificador-dte-go-api",
		BodyLimit:    50 * 1024 * 1024,
		ReadTimeout:  2 * time.Minute,
		WriteTimeout: 10 * time.Minute,
	})

	app.Use(logger.New(logger.Config{
		Format: "${time} ${status} ${method} ${path} ${latency}\n",
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true, "service": "go-dte-api"})
	})

	app.Get("/metrics", func(c *fiber.Ctx) error {
		return c.JSON(shared.MetricsSnapshot())
	})

	dtemodule.Register(app, cfg)
	haciendamodule.Register(app, cfg)

	return app
}
