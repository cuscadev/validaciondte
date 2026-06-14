-- Distrito central por defecto (01) para municipios sin distritos en CAT-008
INSERT INTO cat_008_distritos (codigo, municipio_id, departamento_codigo, nombre)
SELECT
  '01',
  m.id,
  m.departamento_codigo,
  'Distrito Central'
FROM cat_006_municipios m
WHERE COALESCE(m.activo, TRUE) = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM cat_008_distritos d
    WHERE d.municipio_id = m.id
      AND COALESCE(d.activo, TRUE) = TRUE
  )
ON CONFLICT (codigo, municipio_id) DO NOTHING;
