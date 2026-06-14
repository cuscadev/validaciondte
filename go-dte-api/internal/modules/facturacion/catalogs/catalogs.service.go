package catalogs

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	"verificador-dte/go-dte-api/internal/common/config"
)

type Service struct {
	db        *sql.DB
	documents map[string]DocumentSpec
}

type DocumentSpec struct {
	TipoDTE             string `json:"tipoDte"`
	Version             int    `json:"version"`
	Nombre              string `json:"nombre"`
	ReceptorKind        string `json:"receptorKind"`
	ItemsKind           string `json:"itemsKind"`
	RequiresRelatedDocs bool   `json:"requiresRelatedDocs"`
	RequiresContributor bool   `json:"requiresContributor"`
	SchemaVersion       string `json:"schemaVersion"`
}

type CatalogInfo struct {
	Key       string `json:"key"`
	TableName string `json:"tableName"`
	Name      string `json:"name"`
}

type CatalogRowsResponse struct {
	Catalog CatalogInfo      `json:"catalog"`
	Total   int              `json:"total"`
	Rows    []map[string]any `json:"rows"`
}

const (
	TipoDTEFactura        = "01"
	TipoDTECreditoFiscal  = "03"
	TipoDTENotaCredito    = "05"
	TipoDTENotaDebito     = "06"
	TipoDTEExportacion    = "11"
	TipoDTESujetoExcluido = "14"
	TipoDTENotaRemision   = "04"
	TipoDTERetencion      = "07"
	TipoDTELiquidacion    = "08"
	TipoDTEDocContable    = "09"
	TipoDTEDonacion       = "15"

	ReceptorConsumidorFinal = "consumer"
	ReceptorContribuyente   = "taxpayer"
	ReceptorNota            = "note"
	ReceptorExportacion     = "export"
	ReceptorSujetoExcluido  = "excluded_subject"

	ItemsFactura        = "invoice"
	ItemsCreditoFiscal  = "tax_credit"
	ItemsNota           = "adjustment_note"
	ItemsExportacion    = "export"
	ItemsSujetoExcluido = "excluded_subject"
)

var safeCatalogKeyRegex = regexp.MustCompile(`^[a-z0-9_]+$`)

func NewService(cfg config.Config) *Service {
	docs := map[string]DocumentSpec{
		TipoDTEFactura: {
			TipoDTE:       TipoDTEFactura,
			Version:       2,
			Nombre:        "Factura consumidor final",
			ReceptorKind:  ReceptorConsumidorFinal,
			ItemsKind:     ItemsFactura,
			SchemaVersion: "v2",
		},
		TipoDTECreditoFiscal: {
			TipoDTE:             TipoDTECreditoFiscal,
			Version:             4,
			Nombre:              "Comprobante de credito fiscal",
			ReceptorKind:        ReceptorContribuyente,
			ItemsKind:           ItemsCreditoFiscal,
			RequiresContributor: true,
			SchemaVersion:       "v4",
		},
		TipoDTENotaCredito: {
			TipoDTE:             TipoDTENotaCredito,
			Version:             4,
			Nombre:              "Nota de credito",
			ReceptorKind:        ReceptorNota,
			ItemsKind:           ItemsNota,
			RequiresRelatedDocs: true,
			SchemaVersion:       "v4",
		},
		TipoDTENotaDebito: {
			TipoDTE:             TipoDTENotaDebito,
			Version:             4,
			Nombre:              "Nota de debito",
			ReceptorKind:        ReceptorNota,
			ItemsKind:           ItemsNota,
			RequiresRelatedDocs: true,
			SchemaVersion:       "v4",
		},
		TipoDTEExportacion: {
			TipoDTE:       TipoDTEExportacion,
			Version:       1,
			Nombre:        "Factura de exportacion",
			ReceptorKind:  ReceptorExportacion,
			ItemsKind:     ItemsExportacion,
			SchemaVersion: "v1",
		},
		TipoDTESujetoExcluido: {
			TipoDTE:       TipoDTESujetoExcluido,
			Version:       2,
			Nombre:        "Factura de sujeto excluido",
			ReceptorKind:  ReceptorSujetoExcluido,
			ItemsKind:     ItemsSujetoExcluido,
			SchemaVersion: "v2",
		},
		TipoDTENotaRemision: {
			TipoDTE:       TipoDTENotaRemision,
			Version:       3,
			Nombre:        "Nota de remision",
			ReceptorKind:  ReceptorContribuyente,
			ItemsKind:     ItemsCreditoFiscal,
			SchemaVersion: "v3",
		},
		TipoDTERetencion: {
			TipoDTE:       TipoDTERetencion,
			Version:       1,
			Nombre:        "Comprobante de retencion",
			ReceptorKind:  ReceptorContribuyente,
			ItemsKind:     ItemsCreditoFiscal,
			SchemaVersion: "v1",
		},
		TipoDTELiquidacion: {
			TipoDTE:       TipoDTELiquidacion,
			Version:       1,
			Nombre:        "Comprobante de liquidacion",
			ReceptorKind:  ReceptorContribuyente,
			ItemsKind:     ItemsCreditoFiscal,
			SchemaVersion: "v1",
		},
		TipoDTEDocContable: {
			TipoDTE:       TipoDTEDocContable,
			Version:       1,
			Nombre:        "Documento contable de liquidacion",
			ReceptorKind:  ReceptorContribuyente,
			ItemsKind:     ItemsCreditoFiscal,
			SchemaVersion: "v1",
		},
		TipoDTEDonacion: {
			TipoDTE:       TipoDTEDonacion,
			Version:       1,
			Nombre:        "Comprobante de donacion",
			ReceptorKind:  ReceptorConsumidorFinal,
			ItemsKind:     ItemsFactura,
			SchemaVersion: "v1",
		},
	}

	service := &Service{documents: docs}
	if strings.TrimSpace(cfg.DatabaseURL) != "" {
		db, err := sql.Open("pgx", cfg.DatabaseURL)
		if err == nil {
			db.SetMaxOpenConns(10)
			db.SetMaxIdleConns(3)
			db.SetConnMaxLifetime(30 * time.Minute)
			service.db = db
		}
	}

	return service
}

func (s *Service) GetDocumentSpec(tipoDTE string) (DocumentSpec, error) {
	key := strings.TrimSpace(tipoDTE)
	if key == "" {
		return DocumentSpec{}, errors.New("tipoDte es requerido")
	}
	spec, ok := s.documents[key]
	if !ok {
		return DocumentSpec{}, errors.New("tipoDte no soportado")
	}
	return spec, nil
}

func (s *Service) ListDocumentSpecs() []DocumentSpec {
	out := make([]DocumentSpec, 0, len(s.documents))
	for _, spec := range s.documents {
		out = append(out, spec)
	}
	return out
}

func (s *Service) ListCatalogs(ctx context.Context) ([]CatalogInfo, error) {
	if s.db == nil {
		return nil, errors.New("SUPABASE_DB_URL no configurado")
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public'
		  AND table_type = 'BASE TABLE'
		  AND (table_name LIKE 'cat\_%' ESCAPE '\' OR table_name = 'cat_paises')
		ORDER BY table_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []CatalogInfo{}
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			return nil, err
		}
		out = append(out, catalogInfo(tableName))
	}

	return out, rows.Err()
}

func (s *Service) GetCatalogRows(ctx context.Context, key string, limit int) (CatalogRowsResponse, error) {
	tableName, err := s.resolveCatalogTable(ctx, key)
	if err != nil {
		return CatalogRowsResponse{}, err
	}
	if limit <= 0 || limit > 500 {
		limit = 200
	}

	query := fmt.Sprintf("SELECT * FROM %s ORDER BY id LIMIT $1", tableName)
	rows, err := s.db.QueryContext(ctx, query, limit)
	if err != nil {
		return CatalogRowsResponse{}, err
	}
	defer rows.Close()

	records, err := scanRows(rows)
	if err != nil {
		return CatalogRowsResponse{}, err
	}

	return CatalogRowsResponse{
		Catalog: catalogInfo(tableName),
		Total:   len(records),
		Rows:    records,
	}, nil
}

func (s *Service) GetCatalogRowByCode(ctx context.Context, key string, codigo string) (map[string]any, error) {
	tableName, err := s.resolveCatalogTable(ctx, key)
	if err != nil {
		return nil, err
	}
	codigo = strings.TrimSpace(codigo)
	if codigo == "" {
		return nil, errors.New("codigo es requerido")
	}

	query := fmt.Sprintf("SELECT * FROM %s WHERE codigo = $1 LIMIT 1", tableName)
	rows, err := s.db.QueryContext(ctx, query, codigo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records, err := scanRows(rows)
	if err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return nil, errors.New("codigo no encontrado")
	}

	return records[0], nil
}

func (s *Service) resolveCatalogTable(ctx context.Context, key string) (string, error) {
	if s.db == nil {
		return "", errors.New("SUPABASE_DB_URL no configurado")
	}

	normalized := strings.ToLower(strings.TrimSpace(key))
	if !safeCatalogKeyRegex.MatchString(normalized) {
		return "", errors.New("catalogo no valido")
	}

	tableName := normalized
	if !strings.HasPrefix(tableName, "cat_") {
		tableName = "cat_" + tableName
	}

	if tableName != "cat_paises" && !strings.HasPrefix(tableName, "cat_") {
		return "", errors.New("catalogo no permitido")
	}

	var exists bool
	err := s.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = 'public'
			  AND table_type = 'BASE TABLE'
			  AND table_name = $1
			  AND (table_name LIKE 'cat\_%' ESCAPE '\' OR table_name = 'cat_paises')
		)
	`, tableName).Scan(&exists)
	if err != nil {
		return "", err
	}
	if !exists {
		return "", errors.New("catalogo no encontrado")
	}

	return tableName, nil
}

func catalogInfo(tableName string) CatalogInfo {
	key := strings.TrimPrefix(tableName, "cat_")
	return CatalogInfo{
		Key:       key,
		TableName: tableName,
		Name:      humanCatalogName(key),
	}
}

func humanCatalogName(key string) string {
	parts := strings.Split(key, "_")
	for i, part := range parts {
		if part == "" {
			continue
		}
		parts[i] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
}

func scanRows(rows *sql.Rows) ([]map[string]any, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	out := []map[string]any{}
	for rows.Next() {
		values := make([]any, len(columns))
		pointers := make([]any, len(columns))
		for i := range values {
			pointers[i] = &values[i]
		}

		if err := rows.Scan(pointers...); err != nil {
			return nil, err
		}

		row := map[string]any{}
		for i, column := range columns {
			row[column] = normalizeDBValue(values[i])
		}
		out = append(out, row)
	}

	return out, rows.Err()
}

func normalizeDBValue(value any) any {
	switch typed := value.(type) {
	case []byte:
		return string(typed)
	case time.Time:
		return typed.Format(time.RFC3339)
	default:
		return typed
	}
}
