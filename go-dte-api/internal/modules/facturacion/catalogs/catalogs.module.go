package catalogs

import "github.com/gofiber/fiber/v2"

func Register(router fiber.Router, service *Service) {
	controller := NewController(service)

	catalogs := router.Group("/catalogs")
	catalogs.Get("/documents", controller.ListDocuments)
	catalogs.Get("/documents/:tipoDte", controller.GetDocument)
}
