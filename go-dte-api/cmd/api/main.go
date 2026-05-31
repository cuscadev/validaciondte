package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	appmodule "verificador-dte/go-dte-api/internal/app"
	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/modules/dte/shared"
)

func main() {
	cfg := config.Load()
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
