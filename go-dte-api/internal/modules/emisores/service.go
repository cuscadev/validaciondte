package emisores

import (
	"context"
	"errors"
	"strings"

	"verificador-dte/go-dte-api/internal/modules/emisores/dto"
)

type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

func (s *Service) GetMe(ctx context.Context, firebaseUID, email string) (*dto.EmisorRow, error) {
	firebaseUID = strings.TrimSpace(firebaseUID)
	if firebaseUID == "" {
		return nil, errors.New("firebase uid requerido")
	}
	return s.store.GetByFirebaseUID(ctx, firebaseUID, email)
}

func (s *Service) GetDteInputByID(ctx context.Context, id int) (dto.DteEmisorInput, error) {
	row, err := s.store.GetByID(ctx, id)
	if err != nil {
		return dto.DteEmisorInput{}, err
	}
	return MapToDteInput(row), nil
}

func (s *Service) GetDteInputMe(ctx context.Context, firebaseUID, email string) (dto.DteEmisorInput, error) {
	row, err := s.GetMe(ctx, firebaseUID, email)
	if err != nil {
		return dto.DteEmisorInput{}, err
	}
	return MapToDteInput(row), nil
}
