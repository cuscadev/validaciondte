package dto

import "time"

type UpsertUserRequest struct {
	ID                  string  `json:"id"`
	Email               string  `json:"email"`
	Role                string  `json:"role"`
	OrganizationID      *string `json:"organizationId,omitempty"`
	OrgRole             *string `json:"orgRole,omitempty"`
	AccountStatus       string  `json:"accountStatus,omitempty"`
	DisplayName         *string `json:"displayName,omitempty"`
	Disabled            bool    `json:"disabled"`
	MembershipType      *string `json:"membershipType,omitempty"`
	MembershipExpiresAt *string `json:"membershipExpiresAt,omitempty"`
}

type BulkUpsertRequest struct {
	Users []UpsertUserRequest `json:"users"`
}

type UserRow struct {
	ID                  string     `json:"id"`
	Email               string     `json:"email"`
	Role                string     `json:"role"`
	OrganizationID      *string    `json:"organization_id,omitempty"`
	OrgRole             *string    `json:"org_role,omitempty"`
	AccountStatus       string     `json:"account_status"`
	DisplayName         *string    `json:"display_name,omitempty"`
	Disabled            bool       `json:"disabled"`
	MembershipType      *string    `json:"membership_type,omitempty"`
	MembershipExpiresAt *time.Time `json:"membership_expires_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
	SyncedAt            time.Time  `json:"synced_at"`
}

type BulkUpsertResult struct {
	Total    int      `json:"total"`
	Upserted int      `json:"upserted"`
	Errors   []string `json:"errors,omitempty"`
}
