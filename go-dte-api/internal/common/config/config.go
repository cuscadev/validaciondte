package config

import (
	"os"
	"strconv"
)

const defaultListenHost = "0.0.0.0"

type Config struct {
	Port                        string
	Concurrency                 int
	BrowserPoolSize             int
	MinIntervalMs               int
	ScrapeCacheTTLSeconds       int
	PrewarmBrowsers             bool
	UseRodScraper               bool
	HTTPFastPath                bool
	HaciendaEnvironment         string
	HaciendaUserAgent           string
	HaciendaConsultaDteLoteTest string
	HaciendaConsultaDteLoteProd string
}

func Load() Config {
	port := getenv("PORT", "8081")
	concurrency := getenvInt("GO_DTE_CONCURRENCY", 8)
	poolSize := getenvInt("GO_DTE_BROWSER_POOL", minInt(concurrency, 4))
	if poolSize < 1 {
		poolSize = 1
	}

	return Config{
		Port:                          port,
		Concurrency:                   concurrency,
		BrowserPoolSize:               poolSize,
		MinIntervalMs:                 getenvInt("GO_DTE_MIN_INTERVAL_MS", 0),
		ScrapeCacheTTLSeconds:         getenvInt("GO_DTE_SCRAPE_CACHE_TTL", 600),
		PrewarmBrowsers:               getenvBool("GO_DTE_PREWARM", false),
		UseRodScraper:                 getenvBool("GO_DTE_USE_ROD", false),
		HTTPFastPath:                  getenvBool("GO_DTE_HTTP_FAST_PATH", false),
		HaciendaEnvironment:           getenv("HACIENDA_ENV", "test"),
		HaciendaUserAgent:             getenv("HACIENDA_USER_AGENT", "KaiserDTE"),
		HaciendaConsultaDteLoteTest: getenv("HACIENDA_CONSULTA_DTE_LOTE_URL_TEST", "https://apitest.dtes.mh.gob.sv/fesv/recepcion/consultadtelote"),
		HaciendaConsultaDteLoteProd: getenv("HACIENDA_CONSULTA_DTE_LOTE_URL_PROD", "https://api.dtes.mh.gob.sv/fesv/recepcion/consultadtelote"),
	}
}

func (c Config) Addr() string {
	return defaultListenHost + ":" + c.Port
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
	if err != nil {
		return fallback
	}
	return parsed
}

func getenvBool(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
