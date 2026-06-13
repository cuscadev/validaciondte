package app_users

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/app_users/dto"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) Upsert(c *fiber.Ctx) error {
	id := c.Params("id")
	var req dto.UpsertUserRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	if req.ID == "" {
		req.ID = id
	}
	if req.ID != id {
		return fiber.NewError(fiber.StatusBadRequest, "id de ruta y cuerpo no coinciden")
	}

	user, err := ct.service.Upsert(c.Context(), req)
	if err != nil {
		if errors.Is(err, ErrInvalidUserData) {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(fiber.Map{"user": user})
}

func (ct *Controller) BulkUpsert(c *fiber.Ctx) error {
	var req dto.BulkUpsertRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	result, err := ct.service.BulkUpsert(c.Context(), req)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(result)
}

func (ct *Controller) GetByID(c *fiber.Ctx) error {
	user, err := ct.service.GetByID(c.Context(), c.Params("id"))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		if errors.Is(err, ErrInvalidUserData) {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(fiber.Map{"user": user})
}

func (ct *Controller) Delete(c *fiber.Ctx) error {
	if err := ct.service.Delete(c.Context(), c.Params("id")); err != nil {
		if errors.Is(err, ErrInvalidUserData) {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(fiber.Map{"success": true})
}
