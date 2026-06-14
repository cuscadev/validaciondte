-- Correlativos DTE: establecimiento y punto de emisión por emisor
ALTER TABLE emisor_configuracion
  ADD COLUMN IF NOT EXISTS cod_estable VARCHAR(4) DEFAULT '001',
  ADD COLUMN IF NOT EXISTS cod_punto_venta VARCHAR(4) DEFAULT '001',
  ADD COLUMN IF NOT EXISTS tipo_establecimiento_emision VARCHAR(1) DEFAULT 'M';

UPDATE emisor_configuracion
SET
  cod_estable = COALESCE(NULLIF(BTRIM(cod_estable), ''), '001'),
  cod_punto_venta = COALESCE(NULLIF(BTRIM(cod_punto_venta), ''), '001'),
  tipo_establecimiento_emision = COALESCE(NULLIF(BTRIM(tipo_establecimiento_emision), ''), 'M')
WHERE cod_estable IS NULL OR cod_punto_venta IS NULL OR tipo_establecimiento_emision IS NULL;
