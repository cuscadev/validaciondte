package store

import "time"

type EmailConnection struct {
	ID             string
	OrganizationID string
	Provider       string
	EmailAddress   string
	IMAPHost       string
	IMAPPort       int
	IMAPSecure     bool
	MailboxFolder  string
	PasswordEnc    string
	AuthMethod     string
}

type SyncJob struct {
	ID             string
	OrganizationID string
	ConnectionID   string
	DateFrom       string
	DateTo         string
	Status         string
	Cursor         *string
	FoundCount     int
	ImportedCount  int
	SkippedCount   int
	ErrorCount     int
	ErrorMessage   *string
}

type EmailDocument struct {
	ID               string
	OrganizationID   string
	ConnectionID     string
	SyncJobID        string
	MessageUID       string
	AttachmentPartID string
	MessageIDHeader  *string
	MailboxFolder    string
	ContentHash      string
	FileName         string
	StoragePath      *string
	JSONContent      *string
	FileSizeBytes    int
	EmailSubject     string
	EmailDate        string
	ImportStatus     string
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
	IVA              *float64
	SelloRecepcion   *string
	RelatedCodigos   []string
	CreatedAt        time.Time
}

type DocumentLinkInput struct {
	OrganizationID   string
	SourceDocumentID string
	TargetDocumentID string
	LinkType         string
}

type LinkPairInput struct {
	ID               string
	TipoDte          *string
	CodigoGeneracion *string
	RelatedCodigos   []string
}

type ParsedDteFields struct {
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
	IVA              *float64
	SelloRecepcion   *string
	RelatedCodigos   []string
}

type RecordDocumentInput struct {
	OrganizationID   string
	ConnectionID     string
	SyncJobID        string
	MessageUID       string
	AttachmentPartID string
	MessageIDHeader  string
	MailboxFolder    string
	FileName         string
	EmailSubject     string
	EmailDate        string
	ContentHash      string
	FileSize         int
	ImportStatus     string
	StoragePath      *string
	JSONContent      *string
	Parsed           *ParsedDteFields
}

type SyncCursor struct {
	UIDs  []uint32 `json:"uids"`
	Index int      `json:"index"`
}

type SyncJobResultInput struct {
	SyncJobID        string
	OrganizationID   string
	DocumentID       *string
	MessageUID       string
	AttachmentPartID string
	FileName         string
	EmailSubject     string
	EmailDate        string
	ImportStatus     string
	CodigoGeneracion *string
	TipoDte          *string
	TipoDteLabel     *string
	FecEmi           *string
	EmisorNombre     *string
}
