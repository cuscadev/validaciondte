package dto

type AttachmentRef struct {
	MessageID     string   `json:"messageId"`
	ThreadID      string   `json:"threadId,omitempty"`
	AttachmentID  string   `json:"attachmentId"`
	FileName      string   `json:"fileName"`
	MimeType      string   `json:"mimeType,omitempty"`
	EmailSubject  string   `json:"emailSubject,omitempty"`
	EmailDate     string   `json:"emailDate,omitempty"`
	EmailFrom     string   `json:"emailFrom,omitempty"`
	EmailFromName string   `json:"emailFromName,omitempty"`
	EmailTo       []string `json:"emailTo,omitempty"`
	EmailCc       []string `json:"emailCc,omitempty"`
	Snippet       string   `json:"snippet,omitempty"`
	InternalDate  string   `json:"internalDate,omitempty"`
}

type ParsedFields struct {
	CodigoGeneracion *string  `json:"codigoGeneracion"`
	FecEmi           *string  `json:"fecEmi"`
	TipoDte          *string  `json:"tipoDte"`
	TipoDteLabel     *string  `json:"tipoDteLabel"`
	NumeroControl    *string  `json:"numeroControl"`
	Ambiente         *string  `json:"ambiente"`
	EmisorNit        *string  `json:"emisorNit"`
	EmisorNrc        *string  `json:"emisorNrc"`
	EmisorNombre     *string  `json:"emisorNombre"`
	ReceptorNit      *string  `json:"receptorNit"`
	ReceptorNrc      *string  `json:"receptorNrc"`
	MontoTotal       *float64 `json:"montoTotal"`
	Iva              *float64 `json:"iva"`
	SelloRecepcion   *string  `json:"selloRecepcion"`
	RelatedCodigos   []string `json:"relatedCodigos"`
}

type RecordDocumentRequest struct {
	OrganizationID string        `json:"organizationId"`
	FirebaseUserID string        `json:"firebaseUserId,omitempty"`
	ConnectionID   string        `json:"connectionId"`
	SyncJobID      string        `json:"syncJobId"`
	DocumentID     string        `json:"documentId"`
	Source         string        `json:"source,omitempty"`
	MailboxEmail   string        `json:"mailboxEmail,omitempty"`
	Ref            AttachmentRef `json:"ref"`
	ContentHash    string        `json:"contentHash"`
	FileSize       int           `json:"fileSize"`
	RawJSON        string        `json:"rawJson"`
	ImportStatus   string        `json:"importStatus"`
	Parsed         *ParsedFields `json:"parsed,omitempty"`
}

type ListDocumentsQuery struct {
	OrganizationID string `query:"organizationId"`
	SyncJobID      string `query:"syncJobId"`
	ImportStatus   string `query:"importStatus"`
	TipoDte        string `query:"tipoDte"`
	DateFrom       string `query:"dateFrom"`
	DateTo         string `query:"dateTo"`
	Q              string `query:"q"`
	Source         string `query:"source"`
	Mailbox        string `query:"mailbox"`
	Limit          int    `query:"limit"`
	Offset         int    `query:"offset"`
	SortBy         string `query:"sortBy"`
	SortDir        string `query:"sortDir"`
}

type DocumentRow struct {
	ID                 string   `json:"id"`
	OrganizationID     string   `json:"organization_id"`
	ConnectionID       string   `json:"connection_id"`
	SyncJobID          *string  `json:"sync_job_id"`
	Source             string   `json:"source"`
	MailboxEmail       *string  `json:"mailbox_email"`
	FirebaseUserID     *string  `json:"firebase_user_id"`
	GmailMessageID     string   `json:"gmail_message_id"`
	GmailThreadID      *string  `json:"gmail_thread_id"`
	GmailAttachmentID  string   `json:"gmail_attachment_id"`
	GmailSnippet       *string  `json:"gmail_snippet"`
	GmailInternalDate  *string  `json:"gmail_internal_date"`
	ContentHash        string   `json:"content_hash"`
	FileName           string   `json:"file_name"`
	StoragePath        *string  `json:"storage_path"`
	FileSizeBytes      int      `json:"file_size_bytes"`
	EmailSubject       *string  `json:"email_subject"`
	EmailDate          *string  `json:"email_date"`
	EmailFrom          *string  `json:"email_from"`
	EmailFromName      *string  `json:"email_from_name"`
	EmailTo            []string `json:"email_to"`
	EmailCC            []string `json:"email_cc"`
	ImportStatus       string   `json:"import_status"`
	CodigoGeneracion   *string  `json:"codigo_generacion"`
	FecEmi             *string  `json:"fec_emi"`
	TipoDte            *string  `json:"tipo_dte"`
	TipoDteLabel       *string  `json:"tipo_dte_label"`
	NumeroControl      *string  `json:"numero_control"`
	Ambiente           *string  `json:"ambiente"`
	EmisorNit          *string  `json:"emisor_nit"`
	EmisorNrc          *string  `json:"emisor_nrc"`
	EmisorNombre       *string  `json:"emisor_nombre"`
	ReceptorNit        *string  `json:"receptor_nit"`
	ReceptorNrc        *string  `json:"receptor_nrc"`
	MontoTotal         *float64 `json:"monto_total"`
	Iva                *float64 `json:"iva"`
	SelloRecepcion     *string  `json:"sello_recepcion"`
	RelatedCodigos     []string `json:"related_codigos"`
	CreatedAt          string   `json:"created_at"`
	LinkedCount        int      `json:"linked_count"`
}

type DocumentLinkRow struct {
	ID               string `json:"id"`
	OrganizationID   string `json:"organization_id"`
	SourceDocumentID string `json:"source_document_id"`
	TargetDocumentID string `json:"target_document_id"`
	LinkType         string `json:"link_type"`
	CreatedAt        string `json:"created_at"`
}

type UpsertLinkRequest struct {
	OrganizationID   string `json:"organizationId"`
	SourceDocumentID string `json:"sourceDocumentId"`
	TargetDocumentID string `json:"targetDocumentId"`
	LinkType         string `json:"linkType"`
}

type ByIDsRequest struct {
	OrganizationID string   `json:"organizationId"`
	IDs            []string `json:"ids"`
}

type BatchLookupRequest struct {
	OrganizationID        string   `json:"organizationId"`
	MessageAttachmentKeys []string `json:"messageAttachmentKeys"`
	ContentHashes         []string `json:"contentHashes"`
}

type BatchLookupResponse struct {
	ByMessageAttachment map[string]DocumentRow `json:"byMessageAttachment"`
	ByContentHash       map[string]DocumentRow `json:"byContentHash"`
}
