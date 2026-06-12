export type ImapAuthType = 'password' | 'oauth';

export type ImapConnectionRow = {
  id: string;
  organization_id: string;
  email: string;
  host: string;
  port: number;
  secure: boolean;
  provider: string;
  auth_type: ImapAuthType;
  password_enc: string;
  refresh_token_enc: string | null;
  access_token: string | null;
  token_expires_at: string | null;
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
  /** Login con clave de aplicacion (auth basica). */
  password?: string;
  /** Login XOAUTH2 (Microsoft 365 / OAuth). */
  accessToken?: string;
};
