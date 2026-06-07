package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

const defaultListenHost = "0.0.0.0"

type Config struct {
	Port                        string
	Concurrency                 int
	RateLimitPerSec             int
	BrowserPoolSize             int
	MinIntervalMs               int
	ScrapeCacheTTLSeconds       int
	EnrichCreditNotes           bool
	PrewarmBrowsers             bool
	UseRodScraper               bool
	UseBrowser                  bool
	HTTPFastPath                bool
	DatabaseURL                 string
	RedisEnabled                bool
	RedisURL                    string
	RedisTTLSeconds             int
	AsyncBatchThreshold         int
	HaciendaEnvironment         string
	HaciendaUserAgent           string
	HaciendaCertificateHome     string
	HaciendaRecepcionDteTest    string
	HaciendaRecepcionDteProd    string
	HaciendaRecepcionLoteTest   string
	HaciendaRecepcionLoteProd   string
	HaciendaConsultaDteTest     string
	HaciendaConsultaDteProd     string
	HaciendaConsultaDteLoteTest string
	HaciendaConsultaDteLoteProd string
}

func Load() Config {
	loadDotEnv(".env")

	port := getenv("PORT", "8081")
	concurrency := getenvInt("GO_DTE_CONCURRENCY", 8)
	poolSize := getenvInt("GO_DTE_BROWSER_POOL", minInt(concurrency, 4))
	if poolSize < 1 {
		poolSize = 1
	}

	return Config{
		Port:                        port,
		Concurrency:                 concurrency,
		RateLimitPerSec:             getenvInt("GO_DTE_RATE_LIMIT_PER_SEC", 10),
		BrowserPoolSize:             poolSize,
		MinIntervalMs:               getenvInt("GO_DTE_MIN_INTERVAL_MS", 0),
		ScrapeCacheTTLSeconds:       getenvInt("GO_DTE_SCRAPE_CACHE_TTL", 600),
		EnrichCreditNotes:           getenvBool("GO_DTE_ENRICH_NC", false),
		PrewarmBrowsers:             getenvBool("GO_DTE_PREWARM", false),
		RedisEnabled:                getenvBool("GO_DTE_REDIS_ENABLED", false),
		RedisURL:                    getenv("REDIS_URL", ""),
		RedisTTLSeconds:             getenvInt("GO_DTE_REDIS_TTL", 600),
		AsyncBatchThreshold:         getenvInt("GO_DTE_ASYNC_THRESHOLD", 10),
		UseRodScraper:               getenvBool("GO_DTE_USE_ROD", false),
		UseBrowser:                  getenvBool("GO_DTE_USE_BROWSER", false),
		HTTPFastPath:                getenvBool("GO_DTE_HTTP_FAST_PATH", false),
		DatabaseURL:                 getenv("DATABASE_URL", ""),
		HaciendaEnvironment:         getenv("HACIENDA_ENV", "test"),
		HaciendaUserAgent:           getenv("HACIENDA_USER_AGENT", "KaiserDTE"),
		HaciendaCertificateHome:     getenv("HACIENDA_CERTIFICATE_HOME", getenv("CERTIFICATE_HOME", "")),
		HaciendaRecepcionDteTest:    getenv("HACIENDA_RECEPCION_DTE_URL_TEST", "https://apitest.dtes.mh.gob.sv/fesv/recepciondte"),
		HaciendaRecepcionDteProd:    getenv("HACIENDA_RECEPCION_DTE_URL_PROD", "https://api.dtes.mh.gob.sv/fesv/recepciondte"),
		HaciendaRecepcionLoteTest:   getenv("HACIENDA_RECEPCION_LOTE_URL_TEST", "https://apitest.dtes.mh.gob.sv/fesv/recepcionlote/"),
		HaciendaRecepcionLoteProd:   getenv("HACIENDA_RECEPCION_LOTE_URL_PROD", "https://api.dtes.mh.gob.sv/fesv/recepcionlote/"),
		HaciendaConsultaDteTest:     getenv("HACIENDA_CONSULTA_DTE_URL_TEST", "https://apitest.dtes.mh.gob.sv/fesv/recepcion/consultadte"),
		HaciendaConsultaDteProd:     getenv("HACIENDA_CONSULTA_DTE_URL_PROD", "https://api.dtes.mh.gob.sv/fesv/recepcion/consultadte"),
		HaciendaConsultaDteLoteTest: getenv("HACIENDA_CONSULTA_DTE_LOTE_URL_TEST", "https://apitest.dtes.mh.gob.sv/fesv/recepcion/consultadtelote"),
		HaciendaConsultaDteLoteProd: getenv("HACIENDA_CONSULTA_DTE_LOTE_URL_PROD", "https://api.dtes.mh.gob.sv/fesv/recepcion/consultadtelote"),
	}
}

func (c Config) Addr() string {
	return defaultListenHost + ":" + c.Port
}

// EffectiveMinIntervalMs returns the minimum delay between outbound DTE consults.
// GO_DTE_MIN_INTERVAL_MS takes precedence when set; otherwise derives from GO_DTE_RATE_LIMIT_PER_SEC.
func (c Config) EffectiveMinIntervalMs() int {
	if c.MinIntervalMs > 0 {
		return c.MinIntervalMs
	}
	if c.RateLimitPerSec <= 0 {
		return 0
	}
	return (1000 + c.RateLimitPerSec - 1) / c.RateLimitPerSec
}

func loadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		key := strings.TrimSpace(parts[0])
		value := strings.Trim(strings.TrimSpace(parts[1]), `"`)
		if key == "" || os.Getenv(key) != "" {
			continue
		}
		_ = os.Setenv(key, value)
	}
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
