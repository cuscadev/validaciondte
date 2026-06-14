package certificates

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"verificador-dte/go-dte-api/internal/common/config"
)

type Storage struct {
	cfg    config.Config
	client *http.Client
}

func NewStorage(cfg config.Config) *Storage {
	return &Storage{
		cfg: cfg,
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (s *Storage) Upload(ctx context.Context, objectPath string, data []byte) (string, error) {
	baseURL := strings.TrimRight(s.cfg.SupabaseURL, "/")
	serviceKey := strings.TrimSpace(s.cfg.SupabaseServiceRoleKey)
	bucket := strings.TrimSpace(s.cfg.SupabaseCertificatesBucket)
	if bucket == "" {
		bucket = "certificates"
	}

	if baseURL == "" || serviceKey == "" {
		return objectPath, fmt.Errorf("supabase storage no configurado")
	}

	objectPath = strings.TrimLeft(objectPath, "/")
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", baseURL, bucket, objectPath)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("x-upsert", "true")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("supabase upload %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return fmt.Sprintf("%s/%s", bucket, objectPath), nil
}

func (s *Storage) Download(ctx context.Context, storagePath string) ([]byte, error) {
	baseURL := strings.TrimRight(s.cfg.SupabaseURL, "/")
	serviceKey := strings.TrimSpace(s.cfg.SupabaseServiceRoleKey)
	if baseURL == "" || serviceKey == "" {
		return nil, fmt.Errorf("supabase storage no configurado")
	}

	storagePath = strings.TrimLeft(storagePath, "/")
	parts := strings.SplitN(storagePath, "/", 2)
	bucket := "certificates"
	objectPath := storagePath
	if len(parts) == 2 {
		bucket = parts[0]
		objectPath = parts[1]
	}

	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", baseURL, bucket, objectPath)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+serviceKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase download %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return io.ReadAll(resp.Body)
}
