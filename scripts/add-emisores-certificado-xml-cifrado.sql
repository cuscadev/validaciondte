-- Almacena certificados MH cifrados cuando Supabase Storage no esta disponible.
ALTER TABLE emisores
ADD COLUMN IF NOT EXISTS certificado_xml_cifrado TEXT;

COMMENT ON COLUMN emisores.certificado_xml_cifrado IS
  'XML CertificadoMH cifrado (AES-GCM). certificado_path = db:encrypted cuando se usa este campo.';
