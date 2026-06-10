package email

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"sync"

	"verificador-dte/go-dte-api/internal/common/config"
	emailcrypto "verificador-dte/go-dte-api/internal/modules/email/crypto"
	imaputil "verificador-dte/go-dte-api/internal/modules/email/imap"
	"verificador-dte/go-dte-api/internal/modules/email/links"
	microsoftauth "verificador-dte/go-dte-api/internal/modules/email/microsoft"
	mimeutil "verificador-dte/go-dte-api/internal/modules/email/mime"
	"verificador-dte/go-dte-api/internal/modules/email/parse"
	"verificador-dte/go-dte-api/internal/modules/email/store"
)

type Service struct {
	cfg   config.Config
	store *store.PostgresStore
	mu    sync.Mutex
}

func NewService(cfg config.Config, pg *store.PostgresStore) *Service {
	return &Service{cfg: cfg, store: pg}
}

type RunSyncInput struct {
	JobID          string
	OrganizationID string
	ConnectionID   string
	DateFrom       string
	DateTo         string
	CreatedByUID   string
}

func (s *Service) RunSyncSync(ctx context.Context, input RunSyncInput) (*store.SyncJob, error) {
	if err := s.runSyncUntilComplete(ctx, input); err != nil {
		return nil, err
	}
	return s.store.GetSyncJob(ctx, input.JobID, input.OrganizationID)
}

func (s *Service) runSyncUntilComplete(ctx context.Context, input RunSyncInput) error {
	for {
		job, err := s.runSyncBatch(ctx, input)
		if err != nil {
			return err
		}
		if job == nil || job.Status != "running" {
			return nil
		}
	}
}

func (s *Service) runSyncBatch(ctx context.Context, input RunSyncInput) (*store.SyncJob, error) {
	job, err := s.store.GetSyncJob(ctx, input.JobID, input.OrganizationID)
	if err != nil {
		return nil, err
	}
	if job == nil {
		return nil, fmt.Errorf("trabajo de sincronizacion no encontrado")
	}
	if job.Status == "completed" || job.Status == "failed" {
		return job, nil
	}

	connection, err := s.store.GetConnection(ctx, job.ConnectionID, input.OrganizationID)
	if err != nil {
		return nil, err
	}
	if connection == nil {
		return nil, fmt.Errorf("no hay cuenta de correo conectada para esta organizacion")
	}

	password, err := emailcrypto.DecryptSecret(s.cfg.EmailCredentialsKey, connection.PasswordEnc)
	if err != nil {
		return s.failJob(ctx, job.ID, job, err)
	}

	searchStrategy := "generic-envelope"
	if imaputil.IsGmailProvider(connection.Provider, connection.IMAPHost) {
		searchStrategy = "gmail-x-gm-raw"
	}
	log.Printf(
		"[email-sync] job %s start provider=%s host=%s strategy=%s auth=%s dates=%s..%s",
		job.ID, connection.Provider, connection.IMAPHost, searchStrategy, connection.AuthMethod, job.DateFrom, job.DateTo,
	)

	var session *imaputil.Session
	if connection.AuthMethod == "oauth2" {
		accessToken, tokenErr := microsoftauth.RefreshAccessToken(password)
		if tokenErr != nil {
			return s.failJob(ctx, job.ID, job, tokenErr)
		}
		session, err = imaputil.ConnectWithOAuth(
			connection.IMAPHost,
			connection.IMAPPort,
			connection.IMAPSecure,
			connection.EmailAddress,
			accessToken,
			connection.MailboxFolder,
		)
	} else {
		session, err = imaputil.Connect(
			connection.IMAPHost,
			connection.IMAPPort,
			connection.IMAPSecure,
			connection.EmailAddress,
			password,
			connection.MailboxFolder,
		)
	}
	if err != nil {
		return s.failJob(ctx, job.ID, job, err)
	}
	defer session.Logout()

	found := job.FoundCount
	imported := job.ImportedCount
	skipped := job.SkippedCount
	errorsCount := job.ErrorCount

	cursorState, err := cursorFromJob(job.Cursor)
	if err != nil {
		return s.failJob(ctx, job.ID, job, err)
	}

	plan, err := session.SearchAndPrepareBatch(
		connection.Provider,
		connection.IMAPHost,
		job.DateFrom,
		job.DateTo,
		cursorState,
		s.cfg.EmailMessagesPerBatch,
	)
	if err != nil {
		return s.failJob(ctx, job.ID, job, err)
	}

	log.Printf("[email-sync] job %s fetching %d messages", job.ID, len(plan.UIDsToFetch))

	messages, fetchErr := imaputil.FetchMessageSourcesConcurrent(
		session.Client(),
		plan.UIDsToFetch,
		s.cfg.EmailSyncConcurrency,
	)
	if fetchErr != nil {
		log.Printf("[email-sync] fetch warnings job %s: %v", job.ID, fetchErr)
	}

	folder := session.Folder()
	for _, uid := range plan.UIDsToFetch {
		msg, ok := messages[uid]
		if !ok || msg == nil {
			errorsCount++
			continue
		}

		env := plan.Envelopes[uid]
		subject := msg.EnvelopeSubject
		if subject == "" {
			subject = env.Subject
		}
		emailDate := msg.EnvelopeDate
		if emailDate == "" {
			emailDate = env.Date
		}
		messageID := msg.MessageIDHeader
		if messageID == "" {
			messageID = env.MessageIDHeader
		}

		if !imaputil.IsGmailProvider(connection.Provider, connection.IMAPHost) && !imaputil.MatchesEmailSubject(subject) {
			continue
		}

		attachments, err := mimeutil.ExtractJSONAttachments(struct {
			MessageUID      string
			MessageIDHeader string
			Source          []byte
			EmailSubject    string
			EmailDate       string
		}{
			MessageUID:      strconv.FormatUint(uint64(uid), 10),
			MessageIDHeader: messageID,
			Source:          msg.Source,
			EmailSubject:    subject,
			EmailDate:       emailDate,
		})
		if err != nil {
			errorsCount++
			log.Printf("[email-sync] mime job %s uid %d: %v", job.ID, uid, err)
			continue
		}
		if len(attachments) == 0 {
			log.Printf("[email-sync] job %s uid %d: sin adjuntos JSON", job.ID, uid)
			continue
		}
		log.Printf("[email-sync] job %s uid %d: %d adjuntos JSON", job.ID, uid, len(attachments))

		for _, ref := range attachments {
			found++
			if err := s.processAttachment(ctx, processAttachmentInput{
				organizationID: input.OrganizationID,
				connectionID:   connection.ID,
				syncJobID:      job.ID,
				folder:         folder,
				ref:            ref,
				dateFrom:       job.DateFrom,
				dateTo:         job.DateTo,
			}, &imported, &skipped, &errorsCount); err != nil {
				log.Printf("[email-sync] attachment job %s: %v", job.ID, err)
			}
			if err := s.store.UpdateSyncJob(ctx, job.ID, map[string]any{
				"found_count":    found,
				"imported_count": imported,
				"skipped_count":  skipped,
				"error_count":    errorsCount,
			}); err != nil {
				log.Printf("[email-sync] progress update job %s: %v", job.ID, err)
			}
		}
	}

	completed := plan.Completed
	patch := map[string]any{
		"found_count":    found,
		"imported_count": imported,
		"skipped_count":  skipped,
		"error_count":    errorsCount,
	}
	if completed {
		patch["status"] = "completed"
		patch["finished_at"] = store.NowISO()
		patch["cursor"] = nil
	} else {
		patch["status"] = "running"
		nextCursor, err := cursorToStore(plan.NextCursor)
		if err != nil {
			return s.failJob(ctx, job.ID, job, err)
		}
		patch["cursor"] = nextCursor
	}

	if err := s.store.UpdateSyncJob(ctx, job.ID, patch); err != nil {
		return nil, err
	}

	status := "running"
	if completed {
		status = "completed"
	}
	log.Printf(
		"[email-sync] job %s batch done status=%s found=%d imported=%d skipped=%d errors=%d",
		job.ID, status, found, imported, skipped, errorsCount,
	)

	if completed {
		if err := links.RebuildDocumentLinks(ctx, s.store, input.OrganizationID); err != nil {
			log.Printf("[email-sync] rebuild links job %s: %v", job.ID, err)
		}
	}

	return s.store.GetSyncJob(ctx, job.ID, input.OrganizationID)
}

type processAttachmentInput struct {
	organizationID string
	connectionID   string
	syncJobID      string
	folder         string
	ref            mimeutil.JSONAttachment
	dateFrom       string
	dateTo         string
}

func (s *Service) processAttachment(
	ctx context.Context,
	input processAttachmentInput,
	imported, skipped, errorsCount *int,
) error {
	prior, err := s.store.FindDocumentByMessageAttachment(
		ctx,
		input.connectionID,
		input.folder,
		input.ref.MessageUID,
		input.ref.AttachmentPartID,
	)
	if err != nil {
		*errorsCount++
		return err
	}
	if prior != nil {
		*skipped++
		if err := s.recordJobResult(ctx, input, "skipped_duplicate", prior); err != nil {
			log.Printf("[email-sync] job result (duplicate) job %s: %v", input.syncJobID, err)
		}
		return nil
	}

	contentHash := mimeutil.SHA256(input.ref.Buffer)
	existing, err := s.store.FindDocumentByHash(ctx, input.organizationID, contentHash)
	if err != nil {
		*errorsCount++
		return err
	}
	if existing != nil {
		*skipped++
		if err := s.recordJobResult(ctx, input, "skipped_duplicate", existing); err != nil {
			log.Printf("[email-sync] job result (duplicate hash) job %s: %v", input.syncJobID, err)
		}
		return nil
	}

	parsed := parse.ParseDteForImport(input.ref.Buffer)
	base := store.RecordDocumentInput{
		OrganizationID:   input.organizationID,
		ConnectionID:     input.connectionID,
		SyncJobID:        input.syncJobID,
		MessageUID:       input.ref.MessageUID,
		AttachmentPartID: input.ref.AttachmentPartID,
		MessageIDHeader:  input.ref.MessageIDHeader,
		MailboxFolder:    input.folder,
		FileName:         input.ref.FileName,
		EmailSubject:     input.ref.EmailSubject,
		EmailDate:        input.ref.EmailDate,
		ContentHash:      contentHash,
		FileSize:         len(input.ref.Buffer),
		StoragePath:      nil,
		Parsed:           parsedToStoreFields(parsed),
	}

	if parsed == nil {
		*skipped++
		base.ImportStatus = "skipped_invalid"
		doc, insertErr := s.store.InsertDocument(ctx, base)
		if insertErr != nil {
			log.Printf("[email-sync] insert failed (%s): %v", base.ImportStatus, insertErr)
			return insertErr
		}
		if err := s.recordJobResult(ctx, input, base.ImportStatus, doc); err != nil {
			log.Printf("[email-sync] job result job %s: %v", input.syncJobID, err)
		}
		return nil
	}

	if !parse.IsAllowedTipoDte(parsed.TipoDte) {
		*skipped++
		base.ImportStatus = "skipped_unsupported_type"
		doc, insertErr := s.store.InsertDocument(ctx, base)
		if insertErr != nil {
			log.Printf("[email-sync] insert failed (%s): %v", base.ImportStatus, insertErr)
			return insertErr
		}
		if err := s.recordJobResult(ctx, input, base.ImportStatus, doc); err != nil {
			log.Printf("[email-sync] job result job %s: %v", input.syncJobID, err)
		}
		return nil
	}

	if !parse.IsDateInRange(parsed.FecEmi, input.dateFrom, input.dateTo) {
		*skipped++
		base.ImportStatus = "skipped_date"
		doc, insertErr := s.store.InsertDocument(ctx, base)
		if insertErr != nil {
			log.Printf("[email-sync] insert failed (%s): %v", base.ImportStatus, insertErr)
			return insertErr
		}
		if err := s.recordJobResult(ctx, input, base.ImportStatus, doc); err != nil {
			log.Printf("[email-sync] job result job %s: %v", input.syncJobID, err)
		}
		return nil
	}

	if !json.Valid(input.ref.Buffer) {
		*skipped++
		base.ImportStatus = "skipped_invalid"
		doc, insertErr := s.store.InsertDocument(ctx, base)
		if insertErr != nil {
			log.Printf("[email-sync] insert failed (%s): %v", base.ImportStatus, insertErr)
			return insertErr
		}
		if err := s.recordJobResult(ctx, input, base.ImportStatus, doc); err != nil {
			log.Printf("[email-sync] job result job %s: %v", input.syncJobID, err)
		}
		return nil
	}

	jsonContent := string(input.ref.Buffer)
	base.ImportStatus = "imported"
	base.JSONContent = &jsonContent
	*imported++
	doc, insertErr := s.store.InsertDocument(ctx, base)
	if insertErr != nil {
		log.Printf("[email-sync] insert failed: %v", insertErr)
		*errorsCount++
		return insertErr
	}
	if err := s.recordJobResult(ctx, input, base.ImportStatus, doc); err != nil {
		log.Printf("[email-sync] job result job %s: %v", input.syncJobID, err)
	}
	return nil
}

func (s *Service) recordJobResult(
	ctx context.Context,
	input processAttachmentInput,
	status string,
	doc *store.EmailDocument,
) error {
	result := store.SyncJobResultInput{
		SyncJobID:        input.syncJobID,
		OrganizationID:   input.organizationID,
		MessageUID:       input.ref.MessageUID,
		AttachmentPartID: input.ref.AttachmentPartID,
		FileName:         input.ref.FileName,
		EmailSubject:     input.ref.EmailSubject,
		EmailDate:        input.ref.EmailDate,
		ImportStatus:     status,
	}
	if doc != nil {
		result.DocumentID = &doc.ID
		result.CodigoGeneracion = doc.CodigoGeneracion
		result.TipoDte = doc.TipoDte
		result.TipoDteLabel = doc.TipoDteLabel
		result.FecEmi = doc.FecEmi
		result.EmisorNombre = doc.EmisorNombre
		if result.FileName == "" {
			result.FileName = doc.FileName
		}
		if result.EmailSubject == "" {
			result.EmailSubject = doc.EmailSubject
		}
		if result.EmailDate == "" {
			result.EmailDate = doc.EmailDate
		}
	}
	return s.store.InsertSyncJobResult(ctx, result)
}

func parsedToStoreFields(parsed *parse.ParsedDteImport) *store.ParsedDteFields {
	if parsed == nil {
		return nil
	}
	related := make([]string, 0, len(parsed.RelatedDocuments))
	for _, ref := range parsed.RelatedDocuments {
		related = append(related, ref.CodigoGeneracion)
	}
	monto := parsed.MontoTotal
	if monto == 0 {
		monto = 0
	}
	return &store.ParsedDteFields{
		CodigoGeneracion: strPtr(parsed.CodigoGeneracion),
		FecEmi:           strPtr(parsed.FecEmi),
		TipoDte:          strPtr(parsed.TipoDte),
		TipoDteLabel:     strPtr(parsed.TipoDteLabel),
		NumeroControl:    nullableStr(parsed.NumeroControl),
		Ambiente:         nullableStr(parsed.Ambiente),
		EmisorNit:        nullableStr(parsed.EmisorNit),
		EmisorNrc:        nullableStr(parsed.EmisorNrc),
		EmisorNombre:     nullableStr(parsed.EmisorNombre),
		ReceptorNit:      nullableStr(parsed.ReceptorNit),
		ReceptorNrc:      nullableStr(parsed.ReceptorNrc),
		MontoTotal:       &monto,
		IVA:              &parsed.IVA,
		SelloRecepcion:   nullableStr(parsed.SelloRecepcion),
		RelatedCodigos:   related,
	}
}

func strPtr(value string) *string { return &value }

func nullableStr(value string) *string {
	if value == "" {
		return nil
	}
	v := value
	return &v
}

func (s *Service) failJob(ctx context.Context, jobID string, job *store.SyncJob, err error) (*store.SyncJob, error) {
	message := err.Error()
	patch := map[string]any{
		"status":        "failed",
		"error_message": message,
		"finished_at":   store.NowISO(),
	}
	if job != nil {
		patch["found_count"] = job.FoundCount
		patch["imported_count"] = job.ImportedCount
		patch["skipped_count"] = job.SkippedCount
		patch["error_count"] = job.ErrorCount
	}
	_ = s.store.UpdateSyncJob(ctx, jobID, patch)
	return nil, err
}

func cursorFromJob(raw *string) (*imaputil.SyncCursorState, error) {
	cursor, err := store.ParseSyncCursor(raw)
	if err != nil {
		return nil, err
	}
	if cursor == nil {
		return nil, nil
	}
	return &imaputil.SyncCursorState{
		UIDs:  cursor.UIDs,
		Index: cursor.Index,
	}, nil
}

func cursorToStore(state *imaputil.SyncCursorState) (*string, error) {
	if state == nil {
		return nil, nil
	}
	return store.SerializeSyncCursor(&store.SyncCursor{
		UIDs:  state.UIDs,
		Index: state.Index,
	})
}
