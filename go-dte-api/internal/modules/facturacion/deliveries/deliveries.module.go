package deliveries

import "github.com/gofiber/fiber/v2"

func Register(router fiber.Router) {
	service := NewService()
	controller := NewController(service)

	deliveries := router.Group("/deliveries")
	deliveries.Post("/package", controller.BuildPackage)
	deliveries.Post("/download/json", controller.DownloadJSON)
}
