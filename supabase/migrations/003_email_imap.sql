-- IMAP multi-proveedor: email_connections, renombrar gmail_* -> email_*

-- Revocar conexiones OAuth legacy (reconectar con contraseña de app IMAP)
update public.google_gmail_connections
set revoked_at = coalesce(revoked_at, now()),
    updated_at = now()
where revoked_at is null;

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
-- Renombrar tablas gmail_* -> email_*
-- ---------------------------------------------------------------------------
alter table if exists public.gmail_sync_jobs
  drop constraint if exists gmail_sync_jobs_connection_id_fkey;

alter table if exists public.gmail_documents
  drop constraint if exists gmail_documents_connection_id_fkey;

alter table if exists public.gmail_documents
  drop constraint if exists gmail_documents_sync_job_id_fkey;

alter table if exists public.gmail_document_links
  drop constraint if exists gmail_document_links_source_document_id_fkey;

alter table if exists public.gmail_document_links
  drop constraint if exists gmail_document_links_target_document_id_fkey;

alter table if exists public.google_gmail_connections
  rename to google_gmail_connections_legacy;

alter table if exists public.gmail_sync_jobs
  rename to email_sync_jobs;

alter table if exists public.gmail_documents
  rename to email_documents;

alter table if exists public.gmail_document_links
  rename to email_document_links;

-- ---------------------------------------------------------------------------
-- email_documents: columnas IMAP
-- ---------------------------------------------------------------------------
alter table public.email_documents
  rename column gmail_message_id to message_uid;

alter table public.email_documents
  rename column gmail_attachment_id to attachment_part_id;

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

-- ---------------------------------------------------------------------------
-- FKs hacia email_connections (NOT VALID para filas legacy OAuth)
-- ---------------------------------------------------------------------------
alter table public.email_sync_jobs
  add constraint email_sync_jobs_connection_id_fkey
  foreign key (connection_id) references public.email_connections (id) on delete cascade
  not valid;

alter table public.email_documents
  add constraint email_documents_connection_id_fkey
  foreign key (connection_id) references public.email_connections (id) on delete cascade
  not valid;

alter table public.email_documents
  add constraint email_documents_sync_job_id_fkey
  foreign key (sync_job_id) references public.email_sync_jobs (id) on delete set null;

alter table public.email_document_links
  add constraint email_document_links_source_document_id_fkey
  foreign key (source_document_id) references public.email_documents (id) on delete cascade;

alter table public.email_document_links
  add constraint email_document_links_target_document_id_fkey
  foreign key (target_document_id) references public.email_documents (id) on delete cascade;

-- Renombrar indices (opcional, idempotente)
alter index if exists idx_gmail_sync_jobs_org rename to idx_email_sync_jobs_org;
alter index if exists idx_gmail_documents_org_fec_emi rename to idx_email_documents_org_fec_emi;
alter index if exists idx_gmail_documents_org_created rename to idx_email_documents_org_created;
alter index if exists idx_gmail_documents_sync_job rename to idx_email_documents_sync_job;
alter index if exists idx_gmail_documents_org_tipo_fec rename to idx_email_documents_org_tipo_fec;
alter index if exists idx_gmail_documents_org_emisor_nit rename to idx_email_documents_org_emisor_nit;
alter index if exists idx_gmail_documents_org_codigo rename to idx_email_documents_org_codigo;
alter index if exists idx_gmail_document_links_org rename to idx_email_document_links_org;
alter index if exists idx_gmail_document_links_target rename to idx_email_document_links_target;

-- RLS policies renombradas
drop policy if exists "deny_all_gmail_sync_jobs" on public.email_sync_jobs;
drop policy if exists "deny_all_gmail_documents" on public.email_documents;
drop policy if exists "deny_all_gmail_document_links" on public.email_document_links;

create policy "deny_all_email_sync_jobs" on public.email_sync_jobs
  for all using (false);

create policy "deny_all_email_documents" on public.email_documents
  for all using (false);

create policy "deny_all_email_document_links" on public.email_document_links
  for all using (false);
