package email_documents

import (
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"

	"verificador-dte/go-dte-api/internal/modules/email_documents/dto"
)

func scanDocumentRow(row pgx.Row) (*dto.DocumentRow, error) {
	doc, _, err := scanDocumentFields(row, false)
	return doc, err
}

func scanDocumentListRow(row pgx.Row) (*dto.DocumentRow, int, error) {
	return scanDocumentFields(row, true)
}

func scanDocumentFields(row pgx.Row, withTotal bool) (*dto.DocumentRow, int, error) {
	var (
		doc           dto.DocumentRow
		syncJobID     *string
		mailboxEmail  *string
		firebaseUID   *string
		messageKey    string
		threadID      *string
		snippet       *string
		internalDate  *string
		emailSubject  *string
		emailDate     *time.Time
		emailFrom     *string
		emailFromName *string
		emailToRaw    []byte
		emailCcRaw    []byte
		codigo        *string
		fecEmi        *string
		tipoDte       *string
		tipoLabel     *string
		numControl    *string
		ambiente      *string
		emisorNit     *string
		emisorNrc     *string
		emisorNombre  *string
		receptorNit   *string
		receptorNrc   *string
		montoTotal    *float64
		iva           *float64
		sello         *string
		relatedRaw    []byte
		jsonData      []byte
		rawJSON       string
		createdAt     time.Time
		updatedAt     time.Time
		totalCount    int
	)

	base := []any{
		&doc.ID, &doc.OrganizationID, &firebaseUID, &doc.ConnectionID, &syncJobID,
		&doc.Source, &mailboxEmail, &doc.GmailMessageID, &messageKey, &threadID,
		&doc.GmailAttachmentID, &snippet, &internalDate, &doc.ContentHash,
		&doc.FileName, &doc.FileSizeBytes, &emailSubject, &emailDate, &emailFrom,
		&emailFromName, &emailToRaw, &emailCcRaw, &doc.ImportStatus,
		&codigo, &fecEmi, &tipoDte, &tipoLabel, &numControl,
		&ambiente, &emisorNit, &emisorNrc, &emisorNombre, &receptorNit,
		&receptorNrc, &montoTotal, &iva, &sello, &relatedRaw,
		&jsonData, &rawJSON, &createdAt, &updatedAt, &doc.LinkedCount,
	}

	if withTotal {
		base = append(base, &totalCount)
	}

	if err := row.Scan(base...); err != nil {
		if err == pgx.ErrNoRows {
			return nil, 0, nil
		}
		return nil, 0, err
	}

	doc.SyncJobID = syncJobID
	doc.MailboxEmail = mailboxEmail
	doc.FirebaseUserID = firebaseUID
	doc.GmailThreadID = threadID
	doc.GmailSnippet = snippet
	doc.GmailInternalDate = internalDate
	doc.EmailSubject = emailSubject
	if emailDate != nil {
		s := emailDate.UTC().Format(time.RFC3339Nano)
		doc.EmailDate = &s
	}
	doc.EmailFrom = emailFrom
	doc.EmailFromName = emailFromName
	doc.EmailTo = decodeStringArray(emailToRaw)
	doc.EmailCC = decodeStringArray(emailCcRaw)
	doc.CodigoGeneracion = codigo
	doc.FecEmi = fecEmi
	doc.TipoDte = tipoDte
	doc.TipoDteLabel = tipoLabel
	doc.NumeroControl = numControl
	doc.Ambiente = ambiente
	doc.EmisorNit = emisorNit
	doc.EmisorNrc = emisorNrc
	doc.EmisorNombre = emisorNombre
	doc.ReceptorNit = receptorNit
	doc.ReceptorNrc = receptorNrc
	doc.MontoTotal = montoTotal
	doc.Iva = iva
	doc.SelloRecepcion = sello
	doc.RelatedCodigos = decodeStringArray(relatedRaw)
	doc.CreatedAt = createdAt.UTC().Format(time.RFC3339Nano)
	storage := "email_documents/" + doc.ID
	doc.StoragePath = &storage

	return &doc, totalCount, nil
}

func decodeStringArray(raw []byte) []string {
	if len(raw) == 0 {
		return []string{}
	}
	var out []string
	if err := json.Unmarshal(raw, &out); err != nil {
		return []string{}
	}
	return out
}
