package jobs

import "github.com/gofiber/fiber/v2"

func Register(dte fiber.Router) {
	controller := NewController()
	dte.Get("/jobs/:id", controller.Get)
}
