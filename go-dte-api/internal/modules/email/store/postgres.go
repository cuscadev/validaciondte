package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(ctx context.Context, databaseURL string) (*PostgresStore, error) {
	if databaseURL == "" {
		return nil, errors.New("SUPABASE_DB_URL o DATABASE_URL requerido para sync de correo")
	}
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &PostgresStore{pool: pool}, nil
}

func (s *PostgresStore) Close() {
	if s.pool != nil {
		s.pool.Close()
	}
}

func (s *PostgresStore) GetConnection(ctx context.Context, connectionID, organizationID string) (*EmailConnection, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, organization_id, provider, email_address, imap_host, imap_port,
		       imap_secure, COALESCE(mailbox_folder, 'INBOX'), password_enc,
		       COALESCE(auth_method, 'app_password')
		FROM email_connections
		WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL
	`, connectionID, organizationID)

	var conn EmailConnection
	var folder string
	if err := row.Scan(
		&conn.ID, &conn.OrganizationID, &conn.Provider, &conn.EmailAddress,
		&conn.IMAPHost, &conn.IMAPPort, &conn.IMAPSecure, &folder, &conn.PasswordEnc,
		&conn.AuthMethod,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	conn.MailboxFolder = folder
	return &conn, nil
}

func (s *PostgresStore) GetSyncJob(ctx context.Context, jobID, organizationID string) (*SyncJob, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, organization_id, connection_id, date_from, date_to, status, cursor,
		       found_count, imported_count, skipped_count, error_count, error_message
		FROM email_sync_jobs
		WHERE id = $1 AND organization_id = $2
	`, jobID, organizationID)

	var job SyncJob
	var dateFrom pgtype.Date
	var dateTo pgtype.Date
	if err := row.Scan(
		&job.ID, &job.OrganizationID, &job.ConnectionID, &dateFrom, &dateTo,
		&job.Status, &job.Cursor, &job.FoundCount, &job.ImportedCount,
		&job.SkippedCount, &job.ErrorCount, &job.ErrorMessage,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	job.DateFrom = scanDateString(dateFrom)
	job.DateTo = scanDateString(dateTo)
	return &job, nil
}

func (s *PostgresStore) UpdateSyncJob(ctx context.Context, jobID string, patch map[string]any) error {
	sets := make([]string, 0, len(patch))
	args := make([]any, 0, len(patch)+1)
	i := 1
	for key, value := range patch {
		sets = append(sets, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, value)
		i++
	}
	if len(sets) == 0 {
		return nil
	}
	args = append(args, jobID)
	query := fmt.Sprintf("UPDATE email_sync_jobs SET %s WHERE id = $%d", joinComma(sets), i)
	_, err := s.pool.Exec(ctx, query, args...)
	return err
}

func joinComma(parts []string) string {
	out := ""
	for idx, part := range parts {
		if idx > 0 {
			out += ", "
		}
		out += part
	}
	return out
}

func (s *PostgresStore) FindDocumentByMessageAttachment(
	ctx context.Context,
	connectionID, mailboxFolder, messageUID, attachmentPartID string,
) (*EmailDocument, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, organization_id, connection_id, sync_job_id, message_uid, attachment_part_id,
		       message_id_header, mailbox_folder, content_hash, file_name, storage_path, json_content,
		       file_size_bytes, email_subject, email_date, import_status, codigo_generacion, fec_emi,
		       tipo_dte, tipo_dte_label, numero_control, ambiente, emisor_nit, emisor_nrc, emisor_nombre,
		       receptor_nit, receptor_nrc, monto_total, iva, sello_recepcion, related_codigos, created_at
		FROM email_documents
		WHERE connection_id = $1 AND mailbox_folder = $2 AND message_uid = $3 AND attachment_part_id = $4
	`, connectionID, mailboxFolder, messageUID, attachmentPartID)

	doc, err := scanDocument(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return doc, err
}

func (s *PostgresStore) FindDocumentByHash(ctx context.Context, organizationID, contentHash string) (*EmailDocument, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, organization_id, connection_id, sync_job_id, message_uid, attachment_part_id,
		       message_id_header, mailbox_folder, content_hash, file_name, storage_path, json_content,
		       file_size_bytes, email_subject, email_date, import_status, codigo_generacion, fec_emi,
		       tipo_dte, tipo_dte_label, numero_control, ambiente, emisor_nit, emisor_nrc, emisor_nombre,
		       receptor_nit, receptor_nrc, monto_total, iva, sello_recepcion, related_codigos, created_at
		FROM email_documents
		WHERE organization_id = $1 AND content_hash = $2
	`, organizationID, contentHash)

	doc, err := scanDocument(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return doc, err
}

func scanDocument(row pgx.Row) (*EmailDocument, error) {
	var doc EmailDocument
	var related []string
	var fecEmi pgtype.Date
	var emailDate pgtype.Timestamptz
	var createdAt pgtype.Timestamptz
	var jsonContent []byte
	if err := row.Scan(
		&doc.ID, &doc.OrganizationID, &doc.ConnectionID, &doc.SyncJobID, &doc.MessageUID,
		&doc.AttachmentPartID, &doc.MessageIDHeader, &doc.MailboxFolder, &doc.ContentHash,
		&doc.FileName, &doc.StoragePath, &jsonContent, &doc.FileSizeBytes, &doc.EmailSubject,
		&emailDate, &doc.ImportStatus, &doc.CodigoGeneracion, &fecEmi, &doc.TipoDte,
		&doc.TipoDteLabel, &doc.NumeroControl, &doc.Ambiente, &doc.EmisorNit, &doc.EmisorNrc,
		&doc.EmisorNombre, &doc.ReceptorNit, &doc.ReceptorNrc, &doc.MontoTotal, &doc.IVA,
		&doc.SelloRecepcion, &related, &createdAt,
	); err != nil {
		return nil, err
	}
	doc.JSONContent = scanJSONContent(jsonContent)
	doc.FecEmi = scanDatePtr(fecEmi)
	doc.EmailDate = scanTimestamptzString(emailDate)
	doc.CreatedAt = scanTimestamptzTime(createdAt)
	doc.RelatedCodigos = related
	return &doc, nil
}

func (s *PostgresStore) InsertDocument(ctx context.Context, input RecordDocumentInput) (*EmailDocument, error) {
	if input.ImportStatus == "imported" {
		if input.JSONContent == nil || *input.JSONContent == "" {
			return nil, errors.New("documentos importados requieren json_content")
		}
		if input.StoragePath != nil && *input.StoragePath != "" {
			return nil, errors.New("documentos importados no deben usar storage_path")
		}
	}

	meta := parsedToFields(input.Parsed)
	var messageID *string
	if input.MessageIDHeader != "" {
		messageID = &input.MessageIDHeader
	}

	var jsonParam any
	if input.JSONContent != nil && *input.JSONContent != "" {
		if !json.Valid([]byte(*input.JSONContent)) {
			return nil, errors.New("json_content invalido")
		}
		jsonParam = []byte(*input.JSONContent)
	}

	emailDate := parseTimestamptzForInsert(input.EmailDate)
	fecEmi := parseDateForInsert(meta.FecEmi)

	row := s.pool.QueryRow(ctx, `
		INSERT INTO email_documents (
			organization_id, connection_id, sync_job_id, message_uid, attachment_part_id,
			message_id_header, mailbox_folder, content_hash, file_name, storage_path, json_content,
			file_size_bytes, email_subject, email_date, import_status, codigo_generacion, fec_emi,
			tipo_dte, tipo_dte_label, numero_control, ambiente, emisor_nit, emisor_nrc, emisor_nombre,
			receptor_nit, receptor_nrc, monto_total, iva, sello_recepcion, related_codigos
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30
		)
		RETURNING id, organization_id, connection_id, sync_job_id, message_uid, attachment_part_id,
		          message_id_header, mailbox_folder, content_hash, file_name, storage_path, json_content,
		          file_size_bytes, email_subject, email_date, import_status, codigo_generacion, fec_emi,
		          tipo_dte, tipo_dte_label, numero_control, ambiente, emisor_nit, emisor_nrc, emisor_nombre,
		          receptor_nit, receptor_nrc, monto_total, iva, sello_recepcion, related_codigos, created_at
	`,
		input.OrganizationID, input.ConnectionID, input.SyncJobID, input.MessageUID, input.AttachmentPartID,
		messageID, input.MailboxFolder, input.ContentHash, input.FileName, input.StoragePath, jsonParam,
		input.FileSize, input.EmailSubject, emailDate, input.ImportStatus,
		meta.CodigoGeneracion, fecEmi, meta.TipoDte, meta.TipoDteLabel, meta.NumeroControl, meta.Ambiente,
		meta.EmisorNit, meta.EmisorNrc, meta.EmisorNombre, meta.ReceptorNit, meta.ReceptorNrc,
		meta.MontoTotal, meta.IVA, meta.SelloRecepcion, meta.RelatedCodigos,
	)

	return scanDocument(row)
}

func parsedToFields(parsed *ParsedDteFields) ParsedDteFields {
	if parsed == nil {
		return ParsedDteFields{RelatedCodigos: []string{}}
	}
	if parsed.RelatedCodigos == nil {
		parsed.RelatedCodigos = []string{}
	}
	return *parsed
}

func (s *PostgresStore) ListImportedDocumentsForOrg(ctx context.Context, organizationID string) ([]LinkPairInput, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, tipo_dte, codigo_generacion, related_codigos
		FROM email_documents
		WHERE organization_id = $1 AND import_status = 'imported'
	`, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []LinkPairInput
	for rows.Next() {
		var item LinkPairInput
		var related []string
		if err := rows.Scan(&item.ID, &item.TipoDte, &item.CodigoGeneracion, &related); err != nil {
			return nil, err
		}
		item.RelatedCodigos = related
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *PostgresStore) UpsertDocumentLink(ctx context.Context, input DocumentLinkInput) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO email_document_links (organization_id, source_document_id, target_document_id, link_type)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (source_document_id, target_document_id, link_type) DO NOTHING
	`, input.OrganizationID, input.SourceDocumentID, input.TargetDocumentID, input.LinkType)
	return err
}

func ParseSyncCursor(raw *string) (*SyncCursor, error) {
	if raw == nil || *raw == "" {
		return nil, nil
	}
	var cursor SyncCursor
	if err := json.Unmarshal([]byte(*raw), &cursor); err != nil {
		return nil, err
	}
	if cursor.UIDs == nil {
		return nil, errors.New("cursor invalido")
	}
	return &cursor, nil
}

func SerializeSyncCursor(cursor *SyncCursor) (*string, error) {
	if cursor == nil {
		return nil, nil
	}
	data, err := json.Marshal(cursor)
	if err != nil {
		return nil, err
	}
	text := string(data)
	return &text, nil
}

func NowISO() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

func (s *PostgresStore) InsertSyncJobResult(ctx context.Context, input SyncJobResultInput) error {
	emailDate := parseTimestamptzForInsert(input.EmailDate)
	fecEmi := parseDateForInsert(input.FecEmi)

	_, err := s.pool.Exec(ctx, `
		INSERT INTO email_sync_job_results (
			sync_job_id, organization_id, document_id, message_uid, attachment_part_id,
			file_name, email_subject, email_date, import_status, codigo_generacion,
			tipo_dte, tipo_dte_label, fec_emi, emisor_nombre
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
		)
		ON CONFLICT (sync_job_id, message_uid, attachment_part_id) DO UPDATE SET
			document_id = EXCLUDED.document_id,
			file_name = EXCLUDED.file_name,
			email_subject = EXCLUDED.email_subject,
			email_date = EXCLUDED.email_date,
			import_status = EXCLUDED.import_status,
			codigo_generacion = EXCLUDED.codigo_generacion,
			tipo_dte = EXCLUDED.tipo_dte,
			tipo_dte_label = EXCLUDED.tipo_dte_label,
			fec_emi = EXCLUDED.fec_emi,
			emisor_nombre = EXCLUDED.emisor_nombre
	`,
		input.SyncJobID, input.OrganizationID, input.DocumentID, input.MessageUID,
		input.AttachmentPartID, input.FileName, input.EmailSubject, emailDate,
		input.ImportStatus, input.CodigoGeneracion, input.TipoDte, input.TipoDteLabel,
		fecEmi, input.EmisorNombre,
	)
	return err
}
