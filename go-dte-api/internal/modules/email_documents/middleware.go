package email_documents

import (
	"github.com/gofiber/fiber/v2"
)

func InternalAuthMiddleware(apiKey string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if apiKey == "" {
			return c.Next()
		}
		if c.Get("X-Go-Dte-Internal-Key") != apiKey {
			return fiber.NewError(fiber.StatusUnauthorized, "No autorizado")
		}
		return c.Next()
	}
}
