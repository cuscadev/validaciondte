-- Esquema para los documentos JSON (DTE) importados desde correo (Gmail/IMAP).
-- El JSON crudo se guarda en la columna raw_json (no se usa Firebase Storage).

create table if not exists email_documents (
  id text primary key,
  organization_id text not null,
  firebase_user_id text,
  connection_id text not null,
  sync_job_id text,
  source text not null default 'gmail',
  mailbox_email text,
  gmail_message_id text not null,
  message_attachment_key text not null,
  gmail_thread_id text,
  gmail_attachment_id text not null default '',
  gmail_snippet text,
  gmail_internal_date text,
  content_hash text not null,
  file_name text not null default '',
  file_size_bytes integer not null default 0,
  email_subject text,
  email_date timestamptz,
  email_from text,
  email_from_name text,
  email_to jsonb not null default '[]'::jsonb,
  email_cc jsonb not null default '[]'::jsonb,
  import_status text not null,
  codigo_generacion text,
  fec_emi text,
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
  json_data jsonb,
  raw_json text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_documents_org_attachment_uk unique (organization_id, message_attachment_key)
);

create index if not exists email_documents_org_email_date_idx
  on email_documents (organization_id, email_date desc);
create index if not exists email_documents_org_hash_idx
  on email_documents (organization_id, content_hash);
create index if not exists email_documents_org_status_idx
  on email_documents (organization_id, import_status);
create index if not exists email_documents_firebase_user_idx
  on email_documents (firebase_user_id);

create table if not exists email_document_links (
  id text primary key,
  organization_id text not null,
  source_document_id text not null,
  target_document_id text not null,
  link_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists email_document_links_org_source_idx
  on email_document_links (organization_id, source_document_id);
create index if not exists email_document_links_org_target_idx
  on email_document_links (organization_id, target_document_id);
