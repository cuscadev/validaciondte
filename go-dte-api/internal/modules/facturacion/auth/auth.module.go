package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/common/config"
)

type AuthRequest struct {
	User  string `json:"user"`
	Pwd   string `json:"pwd"`
	NIT   string `json:"nit"`
	Clave string `json:"clave"`
}

type AuthResponse struct {
	Success bool   `json:"success"`
	Token   string `json:"token"`
	Body    string `json:"body,omitempty"`
}

type Service struct {
	cfg    config.Config
	client *http.Client
}

func NewService(cfg config.Config) *Service {
	return &Service{
		cfg: cfg,
		client: &http.Client{
			Timeout: 45 * time.Second,
		},
	}
}

func (s *Service) Authenticate(ctx context.Context, req AuthRequest) (AuthResponse, error) {
	user := strings.TrimSpace(firstNonEmpty(req.User, req.NIT))
	password := strings.TrimSpace(firstNonEmpty(req.Pwd, req.Clave))
	if user == "" || password == "" {
		return AuthResponse{}, errors.New("credenciales de hacienda requeridas")
	}

	url := s.cfg.HaciendaAuthURLTest
	if strings.EqualFold(s.cfg.HaciendaEnvironment, "production") || strings.EqualFold(s.cfg.HaciendaEnvironment, "prod") {
		url = s.cfg.HaciendaAuthURLProd
	}

	payload, _ := json.Marshal(map[string]string{
		"user": user,
		"pwd":  password,
	})
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return AuthResponse{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if agent := strings.TrimSpace(s.cfg.HaciendaUserAgent); agent != "" {
		httpReq.Header.Set("User-Agent", agent)
	}

	resp, err := s.client.Do(httpReq)
	if err != nil {
		return AuthResponse{}, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return AuthResponse{}, errors.New("autenticacion hacienda fallo: " + strings.TrimSpace(string(body)))
	}

	var parsed map[string]any
	_ = json.Unmarshal(body, &parsed)
	token := extractToken(parsed, string(body))
	if token == "" {
		return AuthResponse{}, errors.New("token hacienda no encontrado en respuesta")
	}
	return AuthResponse{Success: true, Token: token}, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func extractToken(parsed map[string]any, raw string) string {
	for _, key := range []string{"token", "body", "access_token"} {
		if value, ok := parsed[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return strings.TrimSpace(raw)
}

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (ct *Controller) Auth(c *fiber.Ctx) error {
	var req AuthRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	resp, err := ct.service.Authenticate(c.Context(), req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(resp)
}

func Register(router fiber.Router, cfg config.Config) {
	service := NewService(cfg)
	controller := NewController(service)
	group := router.Group("/hacienda")
	group.Post("/auth", controller.Auth)
}
