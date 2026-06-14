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

func (ct *Controller) ListCatalogs(c *fiber.Ctx) error {
	catalogs, err := ct.service.ListCatalogs(c.Context())
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	return c.JSON(fiber.Map{
		"success":  true,
		"catalogs": catalogs,
	})
}

func (ct *Controller) GetCatalog(c *fiber.Ctx) error {
	resp, err := ct.service.GetCatalogRows(c.Context(), c.Params("catalog"), c.QueryInt("limit", 200))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(fiber.Map{
		"success": true,
		"catalog": resp.Catalog,
		"total":   resp.Total,
		"rows":    resp.Rows,
	})
}

func (ct *Controller) GetCatalogCode(c *fiber.Ctx) error {
	row, err := ct.service.GetCatalogRowByCode(c.Context(), c.Params("catalog"), c.Params("codigo"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	return c.JSON(fiber.Map{
		"success": true,
		"row":     row,
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
