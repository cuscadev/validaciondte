package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/modules/dte/shared"
)

func main() {
	cfg := config.Load()
	if err := shared.InitScrapeRuntime(context.Background(), cfg); err != nil {
		log.Fatalf("worker scrape runtime init failed: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		cancel()
		shared.CloseScrapeRuntime()
	}()

	log.Printf("DTE worker started (redis=%v)", cfg.RedisEnabled)
	for {
		if ctx.Err() != nil {
			return
		}
		payload, err := shared.BlockingPopBatchJob(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("worker queue error: %v", err)
			continue
		}
		log.Printf("worker processing job %s (%d links)", payload.JobID, len(payload.Links))
		resp := shared.ProcessBatchJobPayload(ctx, payload)
		log.Printf("worker completed job %s total=%d", payload.JobID, resp.Total)
	}
}
