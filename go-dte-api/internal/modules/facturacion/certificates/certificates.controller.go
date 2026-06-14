package certificates

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/facturacion/certificates/dto"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) Upload(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "archivo .crt requerido")
	}
	opened, err := file.Open()
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	defer opened.Close()

	data := make([]byte, file.Size)
	if _, err := opened.Read(data); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	req := dto.UploadRequest{
		NIT:         c.FormValue("nit"),
		PasswordPri: c.FormValue("passwordPri"),
	}
	if emisorID, err := strconv.Atoi(c.FormValue("emisorId")); err == nil {
		req.EmisorID = emisorID
	}

	resp, err := ct.service.Upload(c.Context(), data, req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(resp)
}

func (ct *Controller) Warmup(c *fiber.Ctx) error {
	var req dto.WarmupRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	resp, err := ct.service.Warmup(c.Context(), req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(resp)
}

func (ct *Controller) GetCached(c *fiber.Ctx) error {
	nit := c.Query("nit")
	if nit == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nit requerido")
	}
	cert := ct.service.Cache().Get(nit)
	return c.JSON(fiber.Map{
		"success": cert != nil,
		"nit":     nit,
		"activo":  cert != nil && cert.Activo,
	})
}
