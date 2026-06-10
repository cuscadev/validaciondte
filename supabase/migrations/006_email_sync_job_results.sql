-- Resultados por adjunto procesado en cada job (incluye duplicados)

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

comment on table public.email_sync_job_results is
  'Una fila por adjunto procesado en un job de sync (incluye duplicados y omitidos).';
