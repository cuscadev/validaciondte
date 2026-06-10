-- json_content como JSONB nativo (sin archivos en Storage)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_documents'
      AND column_name = 'json_content'
  ) THEN
    ALTER TABLE public.email_documents ADD COLUMN json_content jsonb;
  ELSIF EXISTS (
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
        WHEN json_content IS NULL OR btrim(json_content) = '' THEN NULL
        ELSE json_content::jsonb
      END;
  END IF;
END $$;

COMMENT ON COLUMN public.email_documents.json_content IS
  'DTE JSON importado. Sin archivo en Storage; storage_path solo legacy.';
