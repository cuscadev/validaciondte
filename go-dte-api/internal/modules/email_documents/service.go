package email_documents

import (
	"context"
	"errors"

	"verificador-dte/go-dte-api/internal/modules/email_documents/dto"
)

var ErrNotFound = errors.New("documento no encontrado")

type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

func (s *Service) FindByMessageAttachment(ctx context.Context, organizationID, messageID, attachmentID string) (*dto.DocumentRow, error) {
	return s.store.FindByMessageAttachment(ctx, organizationID, messageID, attachmentID)
}

func (s *Service) FindByHash(ctx context.Context, organizationID, contentHash string) (*dto.DocumentRow, error) {
	return s.store.FindByHash(ctx, organizationID, contentHash)
}

func (s *Service) BatchLookup(ctx context.Context, req dto.BatchLookupRequest) (*dto.BatchLookupResponse, error) {
	if req.OrganizationID == "" {
		return nil, errors.New("organizationId es obligatorio")
	}
	byAttachment, err := s.store.FindByMessageAttachmentKeys(ctx, req.OrganizationID, req.MessageAttachmentKeys)
	if err != nil {
		return nil, err
	}
	byHash, err := s.store.FindByContentHashes(ctx, req.OrganizationID, req.ContentHashes)
	if err != nil {
		return nil, err
	}
	if byAttachment == nil {
		byAttachment = map[string]dto.DocumentRow{}
	}
	if byHash == nil {
		byHash = map[string]dto.DocumentRow{}
	}
	return &dto.BatchLookupResponse{
		ByMessageAttachment: byAttachment,
		ByContentHash:       byHash,
	}, nil
}

func (s *Service) Record(ctx context.Context, req dto.RecordDocumentRequest) (*dto.DocumentRow, error) {
	if req.OrganizationID == "" || req.ConnectionID == "" || req.DocumentID == "" || req.RawJSON == "" {
		return nil, errors.New("organizationId, connectionId, documentId y rawJson son obligatorios")
	}
	return s.store.Record(ctx, req)
}

func (s *Service) GetByID(ctx context.Context, organizationID, documentID string) (*dto.DocumentRow, error) {
	doc, err := s.store.GetByID(ctx, organizationID, documentID)
	if err != nil {
		return nil, err
	}
	if doc == nil {
		return nil, ErrNotFound
	}
	return doc, nil
}

func (s *Service) List(ctx context.Context, q dto.ListDocumentsQuery) ([]dto.DocumentRow, int, error) {
	if q.OrganizationID == "" {
		return nil, 0, errors.New("organizationId es obligatorio")
	}
	return s.store.List(ctx, q)
}

func (s *Service) ListImported(ctx context.Context, organizationID string) ([]dto.DocumentRow, error) {
	return s.store.ListImported(ctx, organizationID)
}

func (s *Service) GetByIDs(ctx context.Context, organizationID string, ids []string) ([]dto.DocumentRow, error) {
	return s.store.GetByIDs(ctx, organizationID, ids)
}

func (s *Service) RawJSON(ctx context.Context, organizationID, documentID string) (string, error) {
	raw, err := s.store.RawJSON(ctx, organizationID, documentID)
	if err != nil {
		return "", err
	}
	if raw == "" {
		return "", ErrNotFound
	}
	return raw, nil
}

func (s *Service) LinkedDocuments(ctx context.Context, organizationID, documentID string) (map[string]any, error) {
	links, err := s.store.LinksForDocument(ctx, organizationID, documentID)
	if err != nil {
		return nil, err
	}

	relatedIDs := make([]string, 0, len(links))
	for _, link := range links {
		if link.SourceDocumentID == documentID {
			relatedIDs = append(relatedIDs, link.TargetDocumentID)
		} else {
			relatedIDs = append(relatedIDs, link.SourceDocumentID)
		}
	}

	docs, err := s.store.GetByIDs(ctx, organizationID, relatedIDs)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"links":     links,
		"documents": docs,
	}, nil
}

func (s *Service) UpsertLink(ctx context.Context, req dto.UpsertLinkRequest) error {
	if req.OrganizationID == "" || req.SourceDocumentID == "" || req.TargetDocumentID == "" {
		return errors.New("organizationId, sourceDocumentId y targetDocumentId son obligatorios")
	}
	return s.store.UpsertLink(ctx, req)
}
