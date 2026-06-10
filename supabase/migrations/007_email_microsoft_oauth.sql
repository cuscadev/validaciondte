-- OAuth2 para Microsoft/Outlook IMAP (Modern Auth)

ALTER TABLE public.email_connections
  ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'app_password'
    CHECK (auth_method IN ('app_password', 'oauth2'));
