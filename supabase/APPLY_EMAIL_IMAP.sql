-- Ejecutar en Supabase Dashboard > SQL Editor (todo de una vez).
-- Corrige: "Could not find the table public.email_connections"
-- Idempotente: se puede re-ejecutar sin romper si ya aplicó parte.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 002 metadata (sobre gmail_documents o email_documents)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'gmail_documents'
  ) then
    alter table public.gmail_documents
      add column if not exists tipo_dte text,
      add column if not exists tipo_dte_label text,
      add column if not exists numero_control text,
      add column if not exists ambiente text,
      add column if not exists emisor_nit text,
      add column if not exists emisor_nrc text,
      add column if not exists emisor_nombre text,
      add column if not exists receptor_nit text,
      add column if not exists receptor_nrc text,
      add column if not exists monto_total numeric,
      add column if not exists iva numeric,
      add column if not exists sello_recepcion text,
      add column if not exists related_codigos jsonb not null default '[]'::jsonb;

    alter table public.gmail_documents drop constraint if exists gmail_documents_import_status_check;
    alter table public.gmail_documents
      add constraint gmail_documents_import_status_check
      check (import_status in (
        'imported', 'skipped_duplicate', 'skipped_date',
        'skipped_invalid', 'skipped_unsupported_type'
      ));
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'email_documents'
  ) then
    alter table public.email_documents
      add column if not exists tipo_dte text,
      add column if not exists tipo_dte_label text,
      add column if not exists numero_control text,
      add column if not exists ambiente text,
      add column if not exists emisor_nit text,
      add column if not exists emisor_nrc text,
      add column if not exists emisor_nombre text,
      add column if not exists receptor_nit text,
      add column if not exists receptor_nrc text,
      add column if not exists monto_total numeric,
      add column if not exists iva numeric,
      add column if not exists sello_recepcion text,
      add column if not exists related_codigos jsonb not null default '[]'::jsonb;

    alter table public.email_documents drop constraint if exists gmail_documents_import_status_check;
    alter table public.email_documents drop constraint if exists email_documents_import_status_check;
    alter table public.email_documents
      add constraint email_documents_import_status_check
      check (import_status in (
        'imported', 'skipped_duplicate', 'skipped_date',
        'skipped_invalid', 'skipped_unsupported_type'
      ));
  end if;
end $$;

-- Links table (nombre legacy o nuevo)
create table if not exists public.gmail_document_links (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  source_document_id uuid not null,
  target_document_id uuid not null,
  link_type text not null check (link_type in (
    'nc_to_invoice', 'nd_to_invoice', 'json_reference'
  )),
  created_at timestamptz not null default now(),
  constraint gmail_document_links_unique
    unique (source_document_id, target_document_id, link_type)
);

-- ---------------------------------------------------------------------------
-- email_connections (tabla que falta)
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

-- Revocar OAuth legacy si existe
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'google_gmail_connections'
  ) then
    update public.google_gmail_connections
    set revoked_at = coalesce(revoked_at, now()), updated_at = now()
    where revoked_at is null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Renombrar gmail_* -> email_* (solo si aún no renombrado)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'gmail_sync_jobs'
  ) then
    alter table public.gmail_sync_jobs
      drop constraint if exists gmail_sync_jobs_connection_id_fkey;
    alter table public.gmail_documents
      drop constraint if exists gmail_documents_connection_id_fkey;
    alter table public.gmail_documents
      drop constraint if exists gmail_documents_sync_job_id_fkey;
    alter table public.gmail_document_links
      drop constraint if exists gmail_document_links_source_document_id_fkey;
    alter table public.gmail_document_links
      drop constraint if exists gmail_document_links_target_document_id_fkey;

    alter table public.google_gmail_connections
      rename to google_gmail_connections_legacy;
    alter table public.gmail_sync_jobs rename to email_sync_jobs;
    alter table public.gmail_documents rename to email_documents;
    alter table public.gmail_document_links rename to email_document_links;
  end if;
end $$;

-- Columnas IMAP en email_documents
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'email_documents'
      and column_name = 'gmail_message_id'
  ) then
    alter table public.email_documents rename column gmail_message_id to message_uid;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'email_documents'
      and column_name = 'gmail_attachment_id'
  ) then
    alter table public.email_documents rename column gmail_attachment_id to attachment_part_id;
  end if;
end $$;

alter table public.email_documents
  add column if not exists message_id_header text;

alter table public.email_documents
  add column if not exists mailbox_folder text not null default 'INBOX';

alter table public.email_documents
  drop constraint if exists gmail_documents_message_attachment_unique;

alter table public.email_documents
  drop constraint if exists email_documents_message_attachment_unique;

alter table public.email_documents
  add constraint email_documents_message_attachment_unique
  unique (connection_id, mailbox_folder, message_uid, attachment_part_id);

-- FKs (NOT VALID para filas legacy)
alter table public.email_sync_jobs
  drop constraint if exists email_sync_jobs_connection_id_fkey;
alter table public.email_sync_jobs
  add constraint email_sync_jobs_connection_id_fkey
  foreign key (connection_id) references public.email_connections (id) on delete cascade
  not valid;

alter table public.email_documents
  drop constraint if exists email_documents_connection_id_fkey;
alter table public.email_documents
  add constraint email_documents_connection_id_fkey
  foreign key (connection_id) references public.email_connections (id) on delete cascade
  not valid;

alter table public.email_documents
  drop constraint if exists email_documents_sync_job_id_fkey;
alter table public.email_documents
  add constraint email_documents_sync_job_id_fkey
  foreign key (sync_job_id) references public.email_sync_jobs (id) on delete set null;

alter table public.email_document_links
  drop constraint if exists email_document_links_source_document_id_fkey;
alter table public.email_document_links
  add constraint email_document_links_source_document_id_fkey
  foreign key (source_document_id) references public.email_documents (id) on delete cascade;

alter table public.email_document_links
  drop constraint if exists email_document_links_target_document_id_fkey;
alter table public.email_document_links
  add constraint email_document_links_target_document_id_fkey
  foreign key (target_document_id) references public.email_documents (id) on delete cascade;

-- Indices
create index if not exists idx_email_documents_org_tipo_fec
  on public.email_documents (organization_id, tipo_dte, fec_emi desc);
create index if not exists idx_email_documents_org_emisor_nit
  on public.email_documents (organization_id, emisor_nit);
create index if not exists idx_email_documents_org_codigo
  on public.email_documents (organization_id, codigo_generacion);
create index if not exists idx_email_document_links_org
  on public.email_document_links (organization_id);
create index if not exists idx_email_document_links_target
  on public.email_document_links (target_document_id);

-- RLS
alter table public.email_sync_jobs enable row level security;
alter table public.email_documents enable row level security;
alter table public.email_document_links enable row level security;

drop policy if exists "deny_all_gmail_sync_jobs" on public.email_sync_jobs;
drop policy if exists "deny_all_email_sync_jobs" on public.email_sync_jobs;
create policy "deny_all_email_sync_jobs" on public.email_sync_jobs for all using (false);

drop policy if exists "deny_all_gmail_documents" on public.email_documents;
drop policy if exists "deny_all_email_documents" on public.email_documents;
create policy "deny_all_email_documents" on public.email_documents for all using (false);

drop policy if exists "deny_all_gmail_document_links" on public.email_document_links;
drop policy if exists "deny_all_email_document_links" on public.email_document_links;
create policy "deny_all_email_document_links" on public.email_document_links for all using (false);

-- Verificación
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'email_connections',
    'email_sync_jobs',
    'email_documents',
    'email_document_links'
  )
order by table_name;

-- ---------------------------------------------------------------------------
-- 004/005 json_content (JSONB en Postgres, sin Storage)
-- ---------------------------------------------------------------------------
alter table public.email_documents
  add column if not exists json_content jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_documents'
      AND column_name = 'json_content'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE public.email_documents
      ALTER COLUMN json_content TYPE jsonb
      USING CASE
        WHEN json_content IS NULL OR btrim(json_content::text) = '' THEN NULL
        ELSE json_content::jsonb
      END;
  END IF;
END $$;

comment on column public.email_documents.json_content is
  'DTE JSON importado. Sin archivo en Storage; storage_path solo legacy.';

-- ---------------------------------------------------------------------------
-- 006 email_sync_job_results (resultados por adjunto en cada job)
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
