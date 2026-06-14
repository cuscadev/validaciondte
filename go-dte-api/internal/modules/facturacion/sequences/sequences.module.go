package sequences

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"

	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/common/db"
)

type NextRequest struct {
	EmisorID        int    `json:"emisorId"`
	NIT             string `json:"nit"`
	TipoDTE         string `json:"tipoDte"`
	Establecimiento string `json:"establecimiento"`
	PuntoEmision    string `json:"puntoEmision"`
}

type NextResponse struct {
	Success       bool   `json:"success"`
	Correlativo   int64  `json:"correlativo"`
	NumeroControl string `json:"numeroControl"`
}

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func (s *Service) Next(ctx context.Context, req NextRequest) (NextResponse, error) {
	tipoDte := strings.TrimSpace(req.TipoDTE)
	nit := strings.TrimSpace(req.NIT)
	establecimiento := defaultCode(req.Establecimiento, "001")
	puntoEmision := defaultCode(req.PuntoEmision, "001")
	if req.EmisorID <= 0 || tipoDte == "" || nit == "" {
		return NextResponse{}, errors.New("emisorId, nit y tipoDte son requeridos")
	}

	var correlativo int64
	err := s.pool.QueryRow(ctx, `
		INSERT INTO dte_control_sequences (
			emisor_id, nit, tipo_dte, establecimiento, punto_emision, current_value, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, 1, CURRENT_TIMESTAMP)
		ON CONFLICT (emisor_id, tipo_dte, establecimiento, punto_emision)
		DO UPDATE SET
			current_value = dte_control_sequences.current_value + 1,
			updated_at = CURRENT_TIMESTAMP
		RETURNING current_value
	`, req.EmisorID, nit, tipoDte, establecimiento, puntoEmision).Scan(&correlativo)
	if err != nil {
		return NextResponse{}, err
	}

	numeroControl := fmt.Sprintf("DTE-%s-M%sP%s-%015d", tipoDte, establecimiento, puntoEmision, correlativo)
	return NextResponse{
		Success:       true,
		Correlativo:   correlativo,
		NumeroControl: numeroControl,
	}, nil
}

func defaultCode(value, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) Next(c *fiber.Ctx) error {
	var req NextRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	resp, err := ct.service.Next(c.Context(), req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(resp)
}

func Register(router fiber.Router, cfg config.Config) {
	if !db.Enabled() {
		return
	}
	service := NewService(db.Pool())
	controller := NewController(service)
	group := router.Group("/sequences")
	group.Post("/next", controller.Next)
	_ = cfg
}
