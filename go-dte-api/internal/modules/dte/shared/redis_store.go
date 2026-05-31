package shared

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"verificador-dte/go-dte-api/internal/common/config"
)

const (
	redisJobQueueKey = "dte:batch:jobs"
	redisJobKeyPref  = "dte:batch:job:"
	redisCachePref   = "dte:consult:"
)

var (
	redisClient *redis.Client
	redisOnce   sync.Once
)

func InitRedisStore(cfg config.Config) {
	redisOnce.Do(func() {
		if !cfg.RedisEnabled || strings.TrimSpace(cfg.RedisURL) == "" {
			return
		}
		opts, err := redis.ParseURL(cfg.RedisURL)
		if err != nil {
			return
		}
		redisClient = redis.NewClient(opts)
	})
}

func CloseRedisStore() {
	if redisClient != nil {
		_ = redisClient.Close()
		redisClient = nil
	}
}

func redisEnabled() bool {
	return redisClient != nil
}

func consultCacheKey(rawURL string) string {
	sanitized := SanitizarURL(rawURL)
	parsed, err := url.Parse(sanitized)
	if err != nil {
		return redisCachePref + strings.ToUpper(sanitized)
	}
	query := parsed.Query()
	ambiente := firstQuery(query, "ambiente")
	if ambiente == "" {
		ambiente = "01"
	}
	codGen := strings.ToUpper(firstQuery(query, "codGen", "codigoGeneracion"))
	fechaEmi := NormalizarFecha(firstQuery(query, "fechaEmi", "fecha"))
	return fmt.Sprintf("%s%s:%s:%s", redisCachePref, ambiente, codGen, fechaEmi)
}

func LookupConsultCache(rawURL string) (Result, bool) {
	if !redisEnabled() {
		return Result{}, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	data, err := redisClient.Get(ctx, consultCacheKey(rawURL)).Bytes()
	if err != nil {
		return Result{}, false
	}
	var result Result
	if err := json.Unmarshal(data, &result); err != nil {
		return Result{}, false
	}
	return result, true
}

func StoreConsultCache(rawURL string, result Result) {
	if !redisEnabled() {
		return
	}
	if result.Estado == "ERROR" && strings.TrimSpace(result.Error) != "" {
		return
	}
	cfg := config.Load()
	ttl := time.Duration(cfg.RedisTTLSeconds) * time.Second
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}
	data, err := json.Marshal(result)
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = redisClient.Set(ctx, consultCacheKey(rawURL), data, ttl).Err()
}

type BatchJobPayload struct {
	JobID             string   `json:"jobId"`
	Links             []string `json:"links"`
	Concurrency       int      `json:"concurrency"`
	EnrichCreditNotes bool     `json:"enrichCreditNotes"`
	IncludeExcel      bool     `json:"includeExcel"`
}

type BatchJobStatus struct {
	JobID        string   `json:"jobId"`
	Status       string   `json:"status"`
	Total        int      `json:"total"`
	Done         int      `json:"done"`
	Resultados   []Result `json:"resultados,omitempty"`
	Filename     string   `json:"filename,omitempty"`
	ExcelBase64  string   `json:"excelBase64,omitempty"`
	Error        string   `json:"error,omitempty"`
	UpdatedAt    string   `json:"updatedAt,omitempty"`
}

func EnqueueBatchJob(payload BatchJobPayload) (string, error) {
	if payload.JobID == "" {
		payload.JobID = uuid.NewString()
	}
	if !redisEnabled() {
		return "", fmt.Errorf("redis no configurado")
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	status := BatchJobStatus{
		JobID:  payload.JobID,
		Status: "pending",
		Total:  len(payload.Links),
		Done:   0,
	}
	if err := saveJobStatus(ctx, status); err != nil {
		return "", err
	}
	if err := redisClient.LPush(ctx, redisJobQueueKey, data).Err(); err != nil {
		return "", err
	}
	return payload.JobID, nil
}

func saveJobStatus(ctx context.Context, status BatchJobStatus) error {
	status.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	data, err := json.Marshal(status)
	if err != nil {
		return err
	}
	return redisClient.Set(ctx, redisJobKeyPref+status.JobID, data, 24*time.Hour).Err()
}

func GetBatchJob(jobID string) (BatchJobStatus, bool) {
	if !redisEnabled() || jobID == "" {
		return BatchJobStatus{}, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	data, err := redisClient.Get(ctx, redisJobKeyPref+jobID).Bytes()
	if err != nil {
		return BatchJobStatus{}, false
	}
	var status BatchJobStatus
	if err := json.Unmarshal(data, &status); err != nil {
		return BatchJobStatus{}, false
	}
	return status, true
}

func UpdateBatchJobProgress(jobID string, done int, resultados []Result) error {
	if !redisEnabled() {
		return nil
	}
	status, ok := GetBatchJob(jobID)
	if !ok {
		return fmt.Errorf("job no encontrado")
	}
	status.Done = done
	status.Resultados = resultados
	status.Status = "processing"
	if done >= status.Total && status.Total > 0 {
		status.Status = "done"
	}
	return saveJobStatus(context.Background(), status)
}

func FailBatchJob(jobID, message string) error {
	if !redisEnabled() {
		return nil
	}
	status, ok := GetBatchJob(jobID)
	if !ok {
		return fmt.Errorf("job no encontrado")
	}
	status.Status = "error"
	status.Error = message
	return saveJobStatus(context.Background(), status)
}

func CompleteBatchJob(jobID string, resp ProcessResponse) error {
	if !redisEnabled() {
		return nil
	}
	status, ok := GetBatchJob(jobID)
	if !ok {
		return fmt.Errorf("job no encontrado")
	}
	status.Status = "done"
	status.Done = resp.Total
	status.Resultados = resp.Resultados
	status.Filename = resp.Filename
	status.ExcelBase64 = resp.ExcelBase64
	return saveJobStatus(context.Background(), status)
}

func BlockingPopBatchJob(ctx context.Context) (BatchJobPayload, error) {
	if !redisEnabled() {
		return BatchJobPayload{}, fmt.Errorf("redis no configurado")
	}
	item, err := redisClient.BRPop(ctx, 0, redisJobQueueKey).Result()
	if err != nil {
		return BatchJobPayload{}, err
	}
	if len(item) < 2 {
		return BatchJobPayload{}, fmt.Errorf("cola vacia")
	}
	var payload BatchJobPayload
	if err := json.Unmarshal([]byte(item[1]), &payload); err != nil {
		return BatchJobPayload{}, err
	}
	return payload, nil
}

func ProcessBatchJobPayload(ctx context.Context, payload BatchJobPayload) ProcessResponse {
	status := BatchJobStatus{
		JobID:  payload.JobID,
		Status: "processing",
		Total:  len(payload.Links),
	}
	_ = saveJobStatus(ctx, status)

	opts := BatchOptions{
		Concurrency:       payload.Concurrency,
		EnrichCreditNotes: payload.EnrichCreditNotes,
		OnProgress: func(done, total int, partial []Result) {
			_ = UpdateBatchJobProgress(payload.JobID, done, partial)
		},
	}
	results := ProcessBatchWithOptions(ctx, payload.Links, opts)
	resp := ProcessResponse{
		Total:      len(results),
		Resultados: results,
	}
	if payload.IncludeExcel {
		excelBase64, err := BuildExcelBase64(results)
		if err == nil {
			resp.ExcelBase64 = excelBase64
			resp.Filename = fmt.Sprintf("resultados_dtes_%d.xlsx", time.Now().UnixMilli())
		}
	}
	_ = CompleteBatchJob(payload.JobID, resp)
	return resp
}
