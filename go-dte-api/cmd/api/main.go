package main

import (
	"log"

	appmodule "verificador-dte/go-dte-api/internal/app"
	"verificador-dte/go-dte-api/internal/common/config"
)

func main() {
	cfg := config.Load()
	app := appmodule.New(cfg)

	log.Printf("DTE API listening on %s", cfg.Addr())
	if err := app.Listen(cfg.Addr()); err != nil {
		log.Fatal(err)
	}
}
