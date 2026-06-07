package catalogs

import "github.com/gofiber/fiber/v2"

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) ListDocuments(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success":   true,
		"documents": ct.service.ListDocumentSpecs(),
	})
}

func (ct *Controller) GetDocument(c *fiber.Ctx) error {
	spec, err := ct.service.GetDocumentSpec(c.Params("tipoDte"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(fiber.Map{
		"success":  true,
		"document": spec,
	})
}
