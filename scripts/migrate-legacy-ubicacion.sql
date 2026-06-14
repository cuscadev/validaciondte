-- Migrar codigos legacy de 4 digitos a 2 digitos en datos transaccionales
-- Ejecutar DESPUES de fix-ubicacion-v2.sql y seed-distritos-default.sql

UPDATE emisores
SET
  municipio_codigo = RIGHT(municipio_codigo, 2),
  distrito_codigo = CASE
    WHEN distrito_codigo IS NULL OR BTRIM(distrito_codigo) = '' THEN distrito_codigo
    ELSE RIGHT(distrito_codigo, 2)
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE municipio_codigo IS NOT NULL
  AND LENGTH(municipio_codigo) > 2;

UPDATE clientes
SET
  municipio_codigo = RIGHT(municipio_codigo, 2),
  distrito_codigo = CASE
    WHEN distrito_codigo IS NULL OR BTRIM(distrito_codigo) = '' THEN distrito_codigo
    ELSE RIGHT(distrito_codigo, 2)
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE municipio_codigo IS NOT NULL
  AND LENGTH(municipio_codigo) > 2;

-- Emisores/clientes con distrito NULL pero municipio valido: asignar distrito 01 si existe en catalogo
UPDATE emisores e
SET
  distrito_codigo = '01',
  updated_at = CURRENT_TIMESTAMP
WHERE e.departamento_codigo IS NOT NULL
  AND e.municipio_codigo IS NOT NULL
  AND (e.distrito_codigo IS NULL OR BTRIM(e.distrito_codigo) = '')
  AND EXISTS (
    SELECT 1
    FROM cat_006_municipios m
    INNER JOIN cat_008_distritos d ON d.municipio_id = m.id
    WHERE m.codigo = e.municipio_codigo
      AND m.departamento_codigo = e.departamento_codigo
      AND d.codigo = '01'
      AND COALESCE(m.activo, TRUE) = TRUE
      AND COALESCE(d.activo, TRUE) = TRUE
  );

UPDATE clientes c
SET
  distrito_codigo = '01',
  updated_at = CURRENT_TIMESTAMP
WHERE c.departamento_codigo IS NOT NULL
  AND c.municipio_codigo IS NOT NULL
  AND (c.distrito_codigo IS NULL OR BTRIM(c.distrito_codigo) = '')
  AND EXISTS (
    SELECT 1
    FROM cat_006_municipios m
    INNER JOIN cat_008_distritos d ON d.municipio_id = m.id
    WHERE m.codigo = c.municipio_codigo
      AND m.departamento_codigo = c.departamento_codigo
      AND d.codigo = '01'
      AND COALESCE(m.activo, TRUE) = TRUE
      AND COALESCE(d.activo, TRUE) = TRUE
  );

-- Distritos que ya no existen en CAT-008: usar distrito 01 del municipio si esta disponible
UPDATE emisores e
SET
  distrito_codigo = '01',
  updated_at = CURRENT_TIMESTAMP
WHERE e.departamento_codigo IS NOT NULL
  AND e.municipio_codigo IS NOT NULL
  AND e.distrito_codigo IS NOT NULL
  AND BTRIM(e.distrito_codigo) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM cat_006_municipios m
    INNER JOIN cat_008_distritos d ON d.municipio_id = m.id
    WHERE m.codigo = e.municipio_codigo
      AND m.departamento_codigo = e.departamento_codigo
      AND d.codigo = e.distrito_codigo
      AND COALESCE(m.activo, TRUE) = TRUE
      AND COALESCE(d.activo, TRUE) = TRUE
  )
  AND EXISTS (
    SELECT 1
    FROM cat_006_municipios m
    INNER JOIN cat_008_distritos d ON d.municipio_id = m.id
    WHERE m.codigo = e.municipio_codigo
      AND m.departamento_codigo = e.departamento_codigo
      AND d.codigo = '01'
      AND COALESCE(m.activo, TRUE) = TRUE
      AND COALESCE(d.activo, TRUE) = TRUE
  );

UPDATE clientes c
SET
  distrito_codigo = '01',
  updated_at = CURRENT_TIMESTAMP
WHERE c.departamento_codigo IS NOT NULL
  AND c.municipio_codigo IS NOT NULL
  AND c.distrito_codigo IS NOT NULL
  AND BTRIM(c.distrito_codigo) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM cat_006_municipios m
    INNER JOIN cat_008_distritos d ON d.municipio_id = m.id
    WHERE m.codigo = c.municipio_codigo
      AND m.departamento_codigo = c.departamento_codigo
      AND d.codigo = c.distrito_codigo
      AND COALESCE(m.activo, TRUE) = TRUE
      AND COALESCE(d.activo, TRUE) = TRUE
  )
  AND EXISTS (
    SELECT 1
    FROM cat_006_municipios m
    INNER JOIN cat_008_distritos d ON d.municipio_id = m.id
    WHERE m.codigo = c.municipio_codigo
      AND m.departamento_codigo = c.departamento_codigo
      AND d.codigo = '01'
      AND COALESCE(m.activo, TRUE) = TRUE
      AND COALESCE(d.activo, TRUE) = TRUE
  );
