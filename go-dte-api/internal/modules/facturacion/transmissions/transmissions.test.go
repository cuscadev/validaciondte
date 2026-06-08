package transmissions

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

func (ct *Controller) DebugEnvironment(c *fiber.Ctx) error {
	// Get token from Authorization header
	authHeader := c.Get("Authorization")
	token := normalizeHaciendaToken(authHeader)

	// Get environment from query or use test
	environment := c.Query("environment", "test")

	// Determine the URL that would be used
	loteURL := ct.service.loteURL(environment)

	return c.JSON(fiber.Map{
		"debug": "lote_transmission",
		"token": fiber.Map{
			"present": token != "",
			"preview": func() string {
				if len(token) > 30 {
					return token[:30] + "..."
				}
				return token
			}(),
			"length":     len(token),
			"has_bearer": strings.HasPrefix(strings.ToLower(token), "bearer "),
		},
		"environment":  environment,
		"hacienda_url": loteURL,
		"config": fiber.Map{
			"HaciendaRecepcionLoteTest": ct.service.cfg.HaciendaRecepcionLoteTest,
			"HaciendaRecepcionLoteProd": ct.service.cfg.HaciendaRecepcionLoteProd,
			"HaciendaEnvironment":       ct.service.cfg.HaciendaEnvironment,
		},
	})
}
