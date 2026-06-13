package db

import (
	"context"
	"fmt"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	pool    *pgxpool.Pool
	once    sync.Once
	initErr error
)

func Init(ctx context.Context, connString string) error {
	once.Do(func() {
		if connString == "" {
			initErr = fmt.Errorf("SUPABASE_DB_URL no configurada")
			return
		}
		cfg, err := pgxpool.ParseConfig(connString)
		if err != nil {
			initErr = err
			return
		}
		if cfg.MaxConns < 4 {
			cfg.MaxConns = 10
		}
		pool, initErr = pgxpool.NewWithConfig(ctx, cfg)
	})
	return initErr
}

func Pool() *pgxpool.Pool {
	return pool
}

func Enabled() bool {
	return pool != nil
}
