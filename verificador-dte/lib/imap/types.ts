export type ImapConnectionRow = {
  id: string;
  organization_id: string;
  email: string;
  host: string;
  port: number;
  secure: boolean;
  provider: string;
  password_enc: string;
  connected_by_uid: string;
  consent_accepted_at: string | null;
  consent_accepted_by_uid: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

export type ImapConnectionConfig = {
  host: string;
  port: number;
  secure: boolean;
  email: string;
  password: string;
};
