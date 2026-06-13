package email_documents

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"verificador-dte/go-dte-api/internal/modules/email_documents/dto"
)

const linkedCountSQL = `(
  select count(*)::int from email_document_links l
  where l.organization_id = d.organization_id
    and (l.source_document_id = d.id or l.target_document_id = d.id)
)`

const selectDocumentSQL = `select d.*, ` + linkedCountSQL + ` as linked_count from email_documents d`

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) FindByMessageAttachment(
	ctx context.Context,
	organizationID, messageID, attachmentID string,
) (*dto.DocumentRow, error) {
	key := messageID + ":" + attachmentID
	row := s.pool.QueryRow(ctx,
		selectDocumentSQL+` where d.organization_id = $1 and d.message_attachment_key = $2 limit 1`,
		organizationID, key,
	)
	doc, err := scanDocumentRow(row)
	return doc, err
}

func (s *Store) FindByHash(ctx context.Context, organizationID, contentHash string) (*dto.DocumentRow, error) {
	row := s.pool.QueryRow(ctx,
		selectDocumentSQL+` where d.organization_id = $1 and d.content_hash = $2 limit 1`,
		organizationID, contentHash,
	)
	doc, err := scanDocumentRow(row)
	return doc, err
}

func (s *Store) FindByMessageAttachmentKeys(
	ctx context.Context,
	organizationID string,
	keys []string,
) (map[string]dto.DocumentRow, error) {
	out := make(map[string]dto.DocumentRow)
	if len(keys) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx,
		selectDocumentSQL+` where d.organization_id = $1 and d.message_attachment_key = any($2)`,
		organizationID, keys,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		doc, err := scanDocumentRow(rows)
		if err != nil {
			return nil, err
		}
		if doc != nil {
			out[doc.GmailMessageID+":"+doc.GmailAttachmentID] = *doc
		}
	}
	return out, rows.Err()
}

func (s *Store) FindByContentHashes(
	ctx context.Context,
	organizationID string,
	hashes []string,
) (map[string]dto.DocumentRow, error) {
	out := make(map[string]dto.DocumentRow)
	if len(hashes) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx,
		selectDocumentSQL+` where d.organization_id = $1 and d.content_hash = any($2)`,
		organizationID, hashes,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		doc, err := scanDocumentRow(rows)
		if err != nil {
			return nil, err
		}
		if doc != nil && doc.ContentHash != "" {
			out[doc.ContentHash] = *doc
		}
	}
	return out, rows.Err()
}

func (s *Store) GetByID(ctx context.Context, organizationID, documentID string) (*dto.DocumentRow, error) {
	row := s.pool.QueryRow(ctx,
		selectDocumentSQL+` where d.organization_id = $1 and d.id = $2 limit 1`,
		organizationID, documentID,
	)
	doc, err := scanDocumentRow(row)
	return doc, err
}

func (s *Store) Record(ctx context.Context, req dto.RecordDocumentRequest) (*dto.DocumentRow, error) {
	source := req.Source
	if source == "" {
		source = "gmail"
	}

	meta := parsedFields(req.Parsed)
	jsonData, _ := json.Marshal(parseJSONObject(req.RawJSON))

	mailbox := strings.TrimSpace(strings.ToLower(req.MailboxEmail))
	var mailboxPtr *string
	if mailbox != "" {
		mailboxPtr = &mailbox
	}

	var firebaseUID *string
	if req.FirebaseUserID != "" {
		firebaseUID = &req.FirebaseUserID
	}

	emailTo, _ := json.Marshal(req.Ref.EmailTo)
	if emailTo == nil {
		emailTo = []byte("[]")
	}
	emailCc, _ := json.Marshal(req.Ref.EmailCc)
	if emailCc == nil {
		emailCc = []byte("[]")
	}
	related, _ := json.Marshal(meta.RelatedCodigos)
	if related == nil {
		related = []byte("[]")
	}

	var threadID *string
	if req.Ref.ThreadID != "" {
		threadID = &req.Ref.ThreadID
	}
	var snippet *string
	if req.Ref.Snippet != "" {
		snippet = &req.Ref.Snippet
	}
	var internalDate *string
	if req.Ref.InternalDate != "" {
		internalDate = &req.Ref.InternalDate
	}
	var emailDate *time.Time
	if t := parseTime(req.Ref.EmailDate); t != nil {
		emailDate = t
	}

	messageKey := req.Ref.MessageID + ":" + req.Ref.AttachmentID

	row := s.pool.QueryRow(ctx, `
		insert into email_documents (
		  id, organization_id, firebase_user_id, connection_id, sync_job_id, source,
		  mailbox_email, gmail_message_id, message_attachment_key, gmail_thread_id,
		  gmail_attachment_id, gmail_snippet, gmail_internal_date, content_hash,
		  file_name, file_size_bytes, email_subject, email_date, email_from,
		  email_from_name, email_to, email_cc, import_status,
		  codigo_generacion, fec_emi, tipo_dte, tipo_dte_label, numero_control,
		  ambiente, emisor_nit, emisor_nrc, emisor_nombre, receptor_nit,
		  receptor_nrc, monto_total, iva, sello_recepcion, related_codigos,
		  json_data, raw_json
		) values (
		  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
		  $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
		  $21::jsonb, $22::jsonb, $23, $24, $25, $26, $27, $28, $29, $30,
		  $31, $32, $33, $34, $35, $36, $37, $38::jsonb, $39::jsonb, $40
		)
		on conflict (organization_id, message_attachment_key)
		  do update set updated_at = now()
		returning *, 0 as linked_count`,
		req.DocumentID,
		req.OrganizationID,
		firebaseUID,
		req.ConnectionID,
		req.SyncJobID,
		source,
		mailboxPtr,
		req.Ref.MessageID,
		messageKey,
		threadID,
		req.Ref.AttachmentID,
		snippet,
		internalDate,
		req.ContentHash,
		req.Ref.FileName,
		req.FileSize,
		nullableString(req.Ref.EmailSubject),
		emailDate,
		nullableString(req.Ref.EmailFrom),
		nullableString(req.Ref.EmailFromName),
		string(emailTo),
		string(emailCc),
		req.ImportStatus,
		meta.CodigoGeneracion,
		meta.FecEmi,
		meta.TipoDte,
		meta.TipoDteLabel,
		meta.NumeroControl,
		meta.Ambiente,
		meta.EmisorNit,
		meta.EmisorNrc,
		meta.EmisorNombre,
		meta.ReceptorNit,
		meta.ReceptorNrc,
		meta.MontoTotal,
		meta.Iva,
		meta.SelloRecepcion,
		string(related),
		string(jsonData),
		req.RawJSON,
	)

	return scanDocumentRow(row)
}

func (s *Store) List(ctx context.Context, q dto.ListDocumentsQuery) ([]dto.DocumentRow, int, error) {
	conditions := []string{"d.organization_id = $1"}
	args := []any{q.OrganizationID}
	argN := 1

	add := func(clause string, value any) {
		argN++
		conditions = append(conditions, strings.Replace(clause, "?", fmt.Sprintf("$%d", argN), 1))
		args = append(args, value)
	}

	if q.SyncJobID != "" {
		add("d.sync_job_id = ?", q.SyncJobID)
	}
	if q.Source != "" {
		add("d.source = ?", q.Source)
	}
	if q.Mailbox != "" {
		add("lower(coalesce(d.mailbox_email, '')) = ?", strings.ToLower(strings.TrimSpace(q.Mailbox)))
	}
	if q.ImportStatus != "" {
		add("d.import_status = ?", q.ImportStatus)
	}
	if q.TipoDte != "" {
		add("d.tipo_dte = ?", q.TipoDte)
	}
	if q.DateFrom != "" {
		add("d.fec_emi >= ?", q.DateFrom)
	}
	if q.DateTo != "" {
		add("d.fec_emi <= ?", q.DateTo)
	}
	if strings.TrimSpace(q.Q) != "" {
		add(`concat_ws(' ',
		  d.codigo_generacion, d.emisor_nit, d.emisor_nrc, d.emisor_nombre,
		  d.numero_control, d.email_subject, d.email_from, d.file_name
		) ilike ?`, "%"+strings.TrimSpace(q.Q)+"%")
	}

	limit := q.Limit
	if limit < 1 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset := q.Offset
	if offset < 0 {
		offset = 0
	}

	argN++
	limitArg := argN
	argN++
	offsetArg := argN

	orderClause := resolveListOrderBy(q.SortBy, q.SortDir)

	query := fmt.Sprintf(`
		select d.*, %s as linked_count, count(*) over() as total_count
		from email_documents d
		where %s
		order by %s
		limit $%d offset $%d`,
		linkedCountSQL,
		strings.Join(conditions, " and "),
		orderClause,
		limitArg,
		offsetArg,
	)
	args = append(args, limit, offset)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var docs []dto.DocumentRow
	total := 0
	for rows.Next() {
		doc, t, err := scanDocumentListRow(rows)
		if err != nil {
			return nil, 0, err
		}
		if total == 0 {
			total = t
		}
		docs = append(docs, *doc)
	}
	return docs, total, rows.Err()
}

func (s *Store) ListImported(ctx context.Context, organizationID string) ([]dto.DocumentRow, error) {
	rows, err := s.pool.Query(ctx,
		selectDocumentSQL+` where d.organization_id = $1 and d.import_status = 'imported'`,
		organizationID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []dto.DocumentRow
	for rows.Next() {
		doc, err := scanDocumentRow(rows)
		if err != nil {
			return nil, err
		}
		docs = append(docs, *doc)
	}
	return docs, rows.Err()
}

func (s *Store) GetByIDs(ctx context.Context, organizationID string, ids []string) ([]dto.DocumentRow, error) {
	if len(ids) == 0 {
		return []dto.DocumentRow{}, nil
	}
	rows, err := s.pool.Query(ctx,
		selectDocumentSQL+` where d.organization_id = $1 and d.id = any($2::text[])`,
		organizationID, ids,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []dto.DocumentRow
	for rows.Next() {
		doc, err := scanDocumentRow(rows)
		if err != nil {
			return nil, err
		}
		docs = append(docs, *doc)
	}
	return docs, rows.Err()
}

func (s *Store) RawJSON(ctx context.Context, organizationID, documentID string) (string, error) {
	var raw string
	err := s.pool.QueryRow(ctx,
		`select raw_json from email_documents where organization_id = $1 and id = $2 limit 1`,
		organizationID, documentID,
	).Scan(&raw)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	return raw, err
}

func (s *Store) LinksForDocument(ctx context.Context, organizationID, documentID string) ([]dto.DocumentLinkRow, error) {
	rows, err := s.pool.Query(ctx, `
		select id, organization_id, source_document_id, target_document_id, link_type, created_at
		from email_document_links
		where organization_id = $1 and (source_document_id = $2 or target_document_id = $2)`,
		organizationID, documentID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var links []dto.DocumentLinkRow
	for rows.Next() {
		var link dto.DocumentLinkRow
		var created time.Time
		if err := rows.Scan(
			&link.ID, &link.OrganizationID, &link.SourceDocumentID,
			&link.TargetDocumentID, &link.LinkType, &created,
		); err != nil {
			return nil, err
		}
		link.CreatedAt = created.UTC().Format(time.RFC3339Nano)
		links = append(links, link)
	}
	return links, rows.Err()
}

func (s *Store) UpsertLink(ctx context.Context, req dto.UpsertLinkRequest) error {
	id := req.SourceDocumentID + "_" + req.TargetDocumentID + "_" + req.LinkType
	_, err := s.pool.Exec(ctx, `
		insert into email_document_links (id, organization_id, source_document_id, target_document_id, link_type)
		values ($1, $2, $3, $4, $5)
		on conflict (id) do nothing`,
		id, req.OrganizationID, req.SourceDocumentID, req.TargetDocumentID, req.LinkType,
	)
	return err
}

type metaFields struct {
	CodigoGeneracion *string
	FecEmi           *string
	TipoDte          *string
	TipoDteLabel     *string
	NumeroControl    *string
	Ambiente         *string
	EmisorNit        *string
	EmisorNrc        *string
	EmisorNombre     *string
	ReceptorNit      *string
	ReceptorNrc      *string
	MontoTotal       *float64
	Iva              *float64
	SelloRecepcion   *string
	RelatedCodigos   []string
}

func parsedFields(p *dto.ParsedFields) metaFields {
	if p == nil {
		return metaFields{RelatedCodigos: []string{}}
	}
	related := p.RelatedCodigos
	if related == nil {
		related = []string{}
	}
	return metaFields{
		CodigoGeneracion: p.CodigoGeneracion,
		FecEmi:           p.FecEmi,
		TipoDte:          p.TipoDte,
		TipoDteLabel:     p.TipoDteLabel,
		NumeroControl:    p.NumeroControl,
		Ambiente:         p.Ambiente,
		EmisorNit:        p.EmisorNit,
		EmisorNrc:        p.EmisorNrc,
		EmisorNombre:     p.EmisorNombre,
		ReceptorNit:      p.ReceptorNit,
		ReceptorNrc:      p.ReceptorNrc,
		MontoTotal:       p.MontoTotal,
		Iva:              p.Iva,
		SelloRecepcion:   p.SelloRecepcion,
		RelatedCodigos:   related,
	}
}

func nullableString(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

func parseTime(value string) *time.Time {
	if value == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, value)
	if err != nil {
		t, err = time.Parse(time.RFC3339Nano, value)
	}
	if err != nil {
		return nil
	}
	return &t
}

func parseJSONObject(raw string) any {
	var v any
	if err := json.Unmarshal([]byte(raw), &v); err != nil {
		return nil
	}
	return v
}

var listSortColumns = map[string]string{
	"email_date":        "d.email_date",
	"email_subject":     "d.email_subject",
	"fec_emi":           "d.fec_emi",
	"emisor_nombre":     "d.emisor_nombre",
	"codigo_generacion": "d.codigo_generacion",
	"monto_total":       "d.monto_total",
	"tipo_dte":          "d.tipo_dte",
	"created_at":        "d.created_at",
}

func resolveListOrderBy(sortBy, sortDir string) string {
	column, ok := listSortColumns[strings.TrimSpace(sortBy)]
	if !ok {
		column = listSortColumns["email_date"]
	}
	dir := "desc"
	if strings.EqualFold(strings.TrimSpace(sortDir), "asc") {
		dir = "asc"
	}
	nulls := "nulls last"
	if dir == "asc" {
		nulls = "nulls first"
	}
	return fmt.Sprintf("%s %s %s, d.created_at desc", column, dir, nulls)
}
