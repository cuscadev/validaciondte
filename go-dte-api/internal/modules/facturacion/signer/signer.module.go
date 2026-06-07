package signer

import (
	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
)

func Register(router fiber.Router, cfg config.Config) {
	service := NewService(cfg)
	controller := NewController(service)

	router.Post("/sign", controller.Sign)
	router.Post("/firmardocumento", controller.SignCompat)
}
