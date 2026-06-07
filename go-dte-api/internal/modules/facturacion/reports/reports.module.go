package reports

import "github.com/gofiber/fiber/v2"

func Register(router fiber.Router) {
	service := NewService()
	controller := NewController(service)

	reports := router.Group("/reports")
	reports.Post("/export/:format", controller.Export)
}
