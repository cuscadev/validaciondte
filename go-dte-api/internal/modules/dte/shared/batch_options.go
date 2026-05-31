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

// LinkEntry asocia una URL de consulta con el archivo de origen.
type LinkEntry struct {
	URL           string
	NombreArchivo string
}

func LinkEntriesFromURLs(links []string) []LinkEntry {
	out := make([]LinkEntry, len(links))
	for i, link := range links {
		out[i] = LinkEntry{URL: link}
	}
	return out
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

func ProcessBatchWithOptions(parent context.Context, links []string, opts BatchOptions) []Result {
	return ProcessLinkEntriesWithOptions(parent, LinkEntriesFromURLs(links), opts)
}
