package main

import (
	"bytes"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/joho/godotenv"

	appmodule "verificador-dte/go-dte-api/internal/app"
	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/modules/dte/shared"
)

func loadEnvFile(path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	raw = bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})
	envMap, err := godotenv.Parse(bytes.NewReader(raw))
	if err != nil {
		return err
	}
	for key, value := range envMap {
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, value)
		}
	}
	return nil
}

func loadEnvFiles() {
	candidates := []string{".env", "go-dte-api/.env"}
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates, filepath.Join(wd, ".env"))
	}
	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), ".env"))
	}
	seen := map[string]bool{}
	for _, path := range candidates {
		if path == "" || seen[path] {
			continue
		}
		seen[path] = true
		if _, err := os.Stat(path); err != nil {
			continue
		}
		if err := loadEnvFile(path); err != nil {
			log.Printf("warn: no se pudo parsear %s: %v", path, err)
			continue
		}
		log.Printf("env: cargado %s", path)
		return
	}
	log.Printf("warn: no se encontro .env — define SUPABASE_DB_URL en el entorno o usa start-dev.ps1")
}

func main() {
	loadEnvFiles()
	cfg := config.Load()
	if cfg.SupabaseDBURL == "" {
		log.Printf("warn: SUPABASE_DB_URL vacia — /api/email-documents deshabilitado")
	} else {
		log.Printf("postgres: SUPABASE_DB_URL configurada")
	}
	app := appmodule.New(cfg)

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		shared.CloseScrapeRuntime()
		_ = app.Shutdown()
	}()

	log.Printf("DTE API listening on %s", cfg.Addr())
	if err := app.Listen(cfg.Addr()); err != nil {
		log.Fatal(err)
	}
}
