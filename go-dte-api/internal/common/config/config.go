package config

import (
	"os"
	"strconv"
)

type Config struct {
	Host                        string
	Port                        string
	Concurrency                 int
	HaciendaEnvironment         string
	HaciendaUserAgent           string
	HaciendaConsultaDteLoteTest string
	HaciendaConsultaDteLoteProd string
}

func Load() Config {
	port := getenv("GO_DTE_API_PORT", "8081")
	host := getenv("GO_DTE_API_HOST", "127.0.0.1")
	concurrency := getenvInt("GO_DTE_CONCURRENCY", 8)

	return Config{
		Host:                        host,
		Port:                        port,
		Concurrency:                 concurrency,
		HaciendaEnvironment:         getenv("HACIENDA_ENV", "test"),
		HaciendaUserAgent:           getenv("HACIENDA_USER_AGENT", "KaiserDTE"),
		HaciendaConsultaDteLoteTest: getenv("HACIENDA_CONSULTA_DTE_LOTE_URL_TEST", "https://apitest.dtes.mh.gob.sv/fesv/recepcion/consultadtelote"),
		HaciendaConsultaDteLoteProd: getenv("HACIENDA_CONSULTA_DTE_LOTE_URL_PROD", "https://api.dtes.mh.gob.sv/fesv/recepcion/consultadtelote"),
	}
}

func (c Config) Addr() string {
	return c.Host + ":" + c.Port
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 1 {
		return fallback
	}
	return parsed
}
