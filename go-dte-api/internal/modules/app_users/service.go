package app_users

import (
	"context"
	"errors"
	"strings"

	"verificador-dte/go-dte-api/internal/modules/app_users/dto"
)

var (
	ErrNotFound        = errors.New("usuario no encontrado")
	ErrInvalidUserData = errors.New("datos de usuario inválidos")
)

type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

func (s *Service) Upsert(ctx context.Context, req dto.UpsertUserRequest) (*dto.UserRow, error) {
	if err := validateUpsert(req); err != nil {
		return nil, err
	}
	return s.store.Upsert(ctx, req)
}

func (s *Service) BulkUpsert(ctx context.Context, req dto.BulkUpsertRequest) (*dto.BulkUpsertResult, error) {
	result := &dto.BulkUpsertResult{Total: len(req.Users)}
	if len(req.Users) == 0 {
		return result, nil
	}

	upserted, bulkErrors := s.store.BulkUpsert(ctx, req.Users)
	result.Upserted = upserted
	result.Errors = bulkErrors
	return result, nil
}

func (s *Service) GetByID(ctx context.Context, id string) (*dto.UserRow, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, ErrInvalidUserData
	}
	user, err := s.store.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrNotFound
	}
	return user, nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return ErrInvalidUserData
	}
	return s.store.Delete(ctx, id)
}

func validateUpsert(req dto.UpsertUserRequest) error {
	id := strings.TrimSpace(req.ID)
	email := strings.TrimSpace(req.Email)
	role := strings.TrimSpace(req.Role)

	if id == "" || email == "" || role == "" {
		return ErrInvalidUserData
	}

	switch role {
	case "superadmin", "cliente", "colaborador":
	default:
		return ErrInvalidUserData
	}

	if req.OrgRole != nil {
		switch strings.TrimSpace(*req.OrgRole) {
		case "administrador", "miembro", "":
		default:
			return ErrInvalidUserData
		}
	}

	switch defaultAccountStatus(req.AccountStatus) {
	case "active", "inactive", "blocked":
	default:
		return ErrInvalidUserData
	}

	return nil
}
