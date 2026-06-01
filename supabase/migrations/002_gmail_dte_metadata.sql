-- Gmail DTE: metadata enriquecida, filtro por tipo, enlaces entre documentos

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

alter table public.gmail_documents
  drop constraint if exists gmail_documents_import_status_check;

alter table public.gmail_documents
  add constraint gmail_documents_import_status_check
  check (import_status in (
    'imported',
    'skipped_duplicate',
    'skipped_date',
    'skipped_invalid',
    'skipped_unsupported_type'
  ));

create index if not exists idx_gmail_documents_org_tipo_fec
  on public.gmail_documents (organization_id, tipo_dte, fec_emi desc);

create index if not exists idx_gmail_documents_org_emisor_nit
  on public.gmail_documents (organization_id, emisor_nit);

create index if not exists idx_gmail_documents_org_codigo
  on public.gmail_documents (organization_id, codigo_generacion);

-- ---------------------------------------------------------------------------
-- gmail_document_links
-- ---------------------------------------------------------------------------
create table if not exists public.gmail_document_links (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  source_document_id uuid not null references public.gmail_documents (id) on delete cascade,
  target_document_id uuid not null references public.gmail_documents (id) on delete cascade,
  link_type text not null check (link_type in (
    'nc_to_invoice',
    'nd_to_invoice',
    'json_reference'
  )),
  created_at timestamptz not null default now(),
  constraint gmail_document_links_unique
    unique (source_document_id, target_document_id, link_type)
);

create index if not exists idx_gmail_document_links_org
  on public.gmail_document_links (organization_id);

create index if not exists idx_gmail_document_links_target
  on public.gmail_document_links (target_document_id);

alter table public.gmail_document_links enable row level security;

create policy "deny_all_gmail_document_links" on public.gmail_document_links
  for all using (false);
