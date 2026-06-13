package app_users

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"verificador-dte/go-dte-api/internal/modules/app_users/dto"
)

const upsertUserSQL = `
insert into app_users (
  id, email, role, organization_id, org_role, account_status,
  display_name, disabled, membership_type, membership_expires_at,
  updated_at, synced_at
) values (
  $1, $2, $3, $4, $5, $6,
  $7, $8, $9, $10,
  now(), now()
)
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  organization_id = excluded.organization_id,
  org_role = excluded.org_role,
  account_status = excluded.account_status,
  display_name = excluded.display_name,
  disabled = excluded.disabled,
  membership_type = excluded.membership_type,
  membership_expires_at = excluded.membership_expires_at,
  updated_at = now(),
  synced_at = now()
returning
  id, email, role, organization_id, org_role, account_status,
  display_name, disabled, membership_type, membership_expires_at,
  created_at, updated_at, synced_at
`

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) Upsert(ctx context.Context, req dto.UpsertUserRequest) (*dto.UserRow, error) {
	row := s.pool.QueryRow(ctx, upsertUserSQL,
		req.ID,
		strings.ToLower(strings.TrimSpace(req.Email)),
		req.Role,
		nullableTrimmed(req.OrganizationID),
		nullableTrimmed(req.OrgRole),
		defaultAccountStatus(req.AccountStatus),
		nullableTrimmed(req.DisplayName),
		req.Disabled,
		nullableTrimmed(req.MembershipType),
		parseOptionalTime(req.MembershipExpiresAt),
	)
	return scanUserRow(row)
}

func (s *Store) BulkUpsert(ctx context.Context, users []dto.UpsertUserRequest) (int, []string) {
	var upserted int
	var errors []string

	for _, user := range users {
		if _, err := s.Upsert(ctx, user); err != nil {
			errors = append(errors, user.ID+": "+err.Error())
			continue
		}
		upserted++
	}

	return upserted, errors
}

func (s *Store) GetByID(ctx context.Context, id string) (*dto.UserRow, error) {
	row := s.pool.QueryRow(ctx, `
		select id, email, role, organization_id, org_role, account_status,
		       display_name, disabled, membership_type, membership_expires_at,
		       created_at, updated_at, synced_at
		from app_users
		where id = $1
	`, id)
	user, err := scanUserRow(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (s *Store) Delete(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `delete from app_users where id = $1`, id)
	return err
}

func scanUserRow(row pgx.Row) (*dto.UserRow, error) {
	var user dto.UserRow
	err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Role,
		&user.OrganizationID,
		&user.OrgRole,
		&user.AccountStatus,
		&user.DisplayName,
		&user.Disabled,
		&user.MembershipType,
		&user.MembershipExpiresAt,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.SyncedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func nullableTrimmed(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func defaultAccountStatus(value string) string {
	switch strings.TrimSpace(value) {
	case "inactive", "blocked":
		return value
	default:
		return "active"
	}
}

func parseOptionalTime(value *string) *time.Time {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, trimmed)
	if err != nil {
		return nil
	}
	return &parsed
}
