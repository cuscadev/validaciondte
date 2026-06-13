// Aplica un archivo SQL usando SUPABASE_DB_URL del .env local.
// Uso: go run ./cmd/apply-schema db/app-users-schema.sql
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func loadDotEnv(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, val)
		}
	}
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Uso: go run ./cmd/apply-schema <archivo.sql>")
		os.Exit(1)
	}

	loadDotEnv(".env")

	dbURL := strings.TrimSpace(os.Getenv("SUPABASE_DB_URL"))
	if dbURL == "" {
		fmt.Fprintln(os.Stderr, "Falta SUPABASE_DB_URL en go-dte-api/.env")
		os.Exit(1)
	}

	sqlPath := os.Args[1]
	sqlBytes, err := os.ReadFile(sqlPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "No se pudo leer %s: %v\n", sqlPath, err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Conexión fallida: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	if _, err := pool.Exec(ctx, string(sqlBytes)); err != nil {
		fmt.Fprintf(os.Stderr, "Error ejecutando SQL: %v\n", err)
		os.Exit(1)
	}

	abs, _ := filepath.Abs(sqlPath)
	fmt.Printf("OK: %s\n", abs)
}
