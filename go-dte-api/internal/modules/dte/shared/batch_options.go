package shared

import (
	"context"

	"verificador-dte/go-dte-api/internal/common/config"
)

type BatchOptions struct {
	Concurrency       int
	EnrichCreditNotes bool
	OnProgress        func(done, total int, partial []Result)
}

func BatchOptionsFromConfig(cfg config.Config, concurrency int) BatchOptions {
	if concurrency <= 0 {
		concurrency = cfg.Concurrency
	}
	return BatchOptions{
		Concurrency:       concurrency,
		EnrichCreditNotes: cfg.EnrichCreditNotes,
	}
}

func ProcessBatch(parent context.Context, links []string, concurrency int) []Result {
	cfg := config.Load()
	return ProcessBatchWithOptions(parent, links, BatchOptionsFromConfig(cfg, concurrency))
}
