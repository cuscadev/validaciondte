-- Gmail DTE import: connections, sync jobs, documents metadata
-- Run in Supabase SQL Editor or via CLI

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- google_gmail_connections
-- ---------------------------------------------------------------------------
create table if not exists public.google_gmail_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  google_email text not null,
  refresh_token_enc text not null,
  access_token text,
  token_expires_at timestamptz,
  connected_by_uid text not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint google_gmail_connections_org_unique unique (organization_id)
);

create index if not exists idx_gmail_connections_org
  on public.google_gmail_connections (organization_id)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- gmail_sync_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.gmail_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  connection_id uuid not null references public.google_gmail_connections (id) on delete cascade,
  date_from date not null,
  date_to date not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  found_count integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  cursor text,
  error_message text,
  created_by_uid text not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists idx_gmail_sync_jobs_org
  on public.gmail_sync_jobs (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- gmail_documents
-- ---------------------------------------------------------------------------
create table if not exists public.gmail_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  connection_id uuid not null references public.google_gmail_connections (id) on delete cascade,
  sync_job_id uuid references public.gmail_sync_jobs (id) on delete set null,
  gmail_message_id text not null,
  gmail_attachment_id text not null,
  content_hash text not null,
  file_name text not null,
  storage_path text,
  file_size_bytes integer not null default 0,
  codigo_generacion text,
  fec_emi date,
  email_subject text,
  email_date timestamptz,
  import_status text not null
    check (import_status in (
      'imported',
      'skipped_duplicate',
      'skipped_date',
      'skipped_invalid'
    )),
  created_at timestamptz not null default now(),
  constraint gmail_documents_message_attachment_unique
    unique (gmail_message_id, gmail_attachment_id),
  constraint gmail_documents_org_hash_unique
    unique (organization_id, content_hash)
);

create index if not exists idx_gmail_documents_org_fec_emi
  on public.gmail_documents (organization_id, fec_emi desc);

create index if not exists idx_gmail_documents_org_created
  on public.gmail_documents (organization_id, created_at desc);

create index if not exists idx_gmail_documents_sync_job
  on public.gmail_documents (sync_job_id);

-- ---------------------------------------------------------------------------
-- Storage bucket (private; access via service role + signed URLs)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents',
  'client-documents',
  false,
  52428800,
  array['application/json', 'text/json', 'application/octet-stream']::text[]
)
on conflict (id) do nothing;

-- RLS: deny direct client access; backend uses service role
alter table public.google_gmail_connections enable row level security;
alter table public.gmail_sync_jobs enable row level security;
alter table public.gmail_documents enable row level security;

create policy "deny_all_gmail_connections" on public.google_gmail_connections
  for all using (false);

create policy "deny_all_gmail_sync_jobs" on public.gmail_sync_jobs
  for all using (false);

create policy "deny_all_gmail_documents" on public.gmail_documents
  for all using (false);
