-- =============================================================================
-- EJECUTAR EN SUPABASE: Dashboard > SQL Editor > New query > Run
-- Proyecto: yjojffpjypyhvflaowrl (o el ref de tu proyecto Supabase)
-- Corrige: "Could not find the table public.email_connections ..."
-- Idempotente: se puede re-ejecutar si ya creó parte de las tablas.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- email_connections
-- ---------------------------------------------------------------------------
create table if not exists public.email_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  provider text not null check (provider in ('gmail', 'yahoo', 'microsoft')),
  email_address text not null,
  imap_host text not null,
  imap_port integer not null default 993,
  imap_secure boolean not null default true,
  mailbox_folder text not null default 'INBOX',
  password_enc text not null,
  auth_method text not null default 'app_password'
    check (auth_method in ('app_password', 'oauth2')),
  connected_by_uid text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists idx_email_connections_org_email_provider_active
  on public.email_connections (organization_id, email_address, provider)
  where revoked_at is null;

create index if not exists idx_email_connections_org
  on public.email_connections (organization_id)
  where revoked_at is null;

alter table public.email_connections enable row level security;
drop policy if exists "deny_all_email_connections" on public.email_connections;
create policy "deny_all_email_connections" on public.email_connections
  for all using (false);

-- ---------------------------------------------------------------------------
-- email_sync_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.email_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  connection_id uuid not null references public.email_connections (id) on delete cascade,
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

create index if not exists idx_email_sync_jobs_org
  on public.email_sync_jobs (organization_id, created_at desc);

alter table public.email_sync_jobs enable row level security;
drop policy if exists "deny_all_email_sync_jobs" on public.email_sync_jobs;
create policy "deny_all_email_sync_jobs" on public.email_sync_jobs
  for all using (false);

-- ---------------------------------------------------------------------------
-- email_documents
-- ---------------------------------------------------------------------------
create table if not exists public.email_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  connection_id uuid not null references public.email_connections (id) on delete cascade,
  sync_job_id uuid references public.email_sync_jobs (id) on delete set null,
  message_uid text not null,
  attachment_part_id text not null,
  message_id_header text,
  mailbox_folder text not null default 'INBOX',
  content_hash text not null,
  file_name text not null,
  storage_path text,
  json_content jsonb,
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
      'skipped_invalid',
      'skipped_unsupported_type'
    )),
  tipo_dte text,
  tipo_dte_label text,
  numero_control text,
  ambiente text,
  emisor_nit text,
  emisor_nrc text,
  emisor_nombre text,
  receptor_nit text,
  receptor_nrc text,
  monto_total numeric,
  iva numeric,
  sello_recepcion text,
  related_codigos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint email_documents_message_attachment_unique
    unique (connection_id, mailbox_folder, message_uid, attachment_part_id),
  constraint email_documents_org_hash_unique
    unique (organization_id, content_hash)
);

create index if not exists idx_email_documents_org_fec_emi
  on public.email_documents (organization_id, fec_emi desc);
create index if not exists idx_email_documents_org_created
  on public.email_documents (organization_id, created_at desc);
create index if not exists idx_email_documents_sync_job
  on public.email_documents (sync_job_id);
create index if not exists idx_email_documents_org_tipo_fec
  on public.email_documents (organization_id, tipo_dte, fec_emi desc);
create index if not exists idx_email_documents_org_emisor_nit
  on public.email_documents (organization_id, emisor_nit);
create index if not exists idx_email_documents_org_codigo
  on public.email_documents (organization_id, codigo_generacion);

alter table public.email_documents enable row level security;
drop policy if exists "deny_all_email_documents" on public.email_documents;
create policy "deny_all_email_documents" on public.email_documents
  for all using (false);

-- ---------------------------------------------------------------------------
-- email_document_links
-- ---------------------------------------------------------------------------
create table if not exists public.email_document_links (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  source_document_id uuid not null references public.email_documents (id) on delete cascade,
  target_document_id uuid not null references public.email_documents (id) on delete cascade,
  link_type text not null check (link_type in (
    'nc_to_invoice',
    'nd_to_invoice',
    'json_reference'
  )),
  created_at timestamptz not null default now(),
  constraint email_document_links_unique
    unique (source_document_id, target_document_id, link_type)
);

create index if not exists idx_email_document_links_org
  on public.email_document_links (organization_id);
create index if not exists idx_email_document_links_target
  on public.email_document_links (target_document_id);

alter table public.email_document_links enable row level security;
drop policy if exists "deny_all_email_document_links" on public.email_document_links;
create policy "deny_all_email_document_links" on public.email_document_links
  for all using (false);

-- ---------------------------------------------------------------------------
-- email_sync_job_results
-- ---------------------------------------------------------------------------
create table if not exists public.email_sync_job_results (
  id uuid primary key default gen_random_uuid(),
  sync_job_id uuid not null references public.email_sync_jobs (id) on delete cascade,
  organization_id text not null,
  document_id uuid references public.email_documents (id) on delete set null,
  message_uid text not null,
  attachment_part_id text not null,
  file_name text,
  email_subject text,
  email_date timestamptz,
  import_status text not null check (import_status in (
    'imported',
    'skipped_duplicate',
    'skipped_date',
    'skipped_invalid',
    'skipped_unsupported_type'
  )),
  codigo_generacion text,
  tipo_dte text,
  tipo_dte_label text,
  fec_emi date,
  emisor_nombre text,
  created_at timestamptz not null default now(),
  constraint email_sync_job_results_unique
    unique (sync_job_id, message_uid, attachment_part_id)
);

create index if not exists idx_email_sync_job_results_job
  on public.email_sync_job_results (sync_job_id);

alter table public.email_sync_job_results enable row level security;
drop policy if exists "deny_all_email_sync_job_results" on public.email_sync_job_results;
create policy "deny_all_email_sync_job_results" on public.email_sync_job_results
  for all using (false);

-- ---------------------------------------------------------------------------
-- Storage bucket (JSON importados)
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

-- ---------------------------------------------------------------------------
-- Verificacion (debe listar 4 tablas)
-- ---------------------------------------------------------------------------
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'email_connections',
    'email_sync_jobs',
    'email_documents',
    'email_document_links',
    'email_sync_job_results'
  )
order by table_name;
