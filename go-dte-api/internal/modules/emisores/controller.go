package emisores

import (
	"errors"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) GetMe(c *fiber.Ctx) error {
	firebaseUID := c.Get("X-Firebase-UID")
	email := c.Get("X-User-Email")
	if firebaseUID == "" {
		firebaseUID = c.Query("firebaseUid")
	}
	emisor, err := ct.service.GetMe(c.Context(), firebaseUID, email)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(fiber.Map{"emitter": emisor})
}

func (ct *Controller) GetDteInput(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "id invalido")
	}
	input, err := ct.service.GetDteInputByID(c.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(fiber.Map{"success": true, "emisorId": id, "emisor": input})
}

func (ct *Controller) GetMeDteInput(c *fiber.Ctx) error {
	firebaseUID := c.Get("X-Firebase-UID")
	if firebaseUID == "" {
		firebaseUID = c.Query("firebaseUid")
	}
	row, err := ct.service.GetMe(c.Context(), firebaseUID, c.Get("X-User-Email"))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	input := MapToDteInput(row)
	return c.JSON(fiber.Map{"success": true, "emisorId": row.ID, "emisor": input})
}
