-- Guardar JSON DTE como texto en Postgres (sin archivo en Storage)

alter table public.email_documents
  add column if not exists json_content text;

comment on column public.email_documents.json_content is
  'Contenido JSON del DTE importado. Documentos nuevos usan esta columna; storage_path queda para legacy.';
