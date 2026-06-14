-- Detectar emisores/clientes con ubicacion invalida
SELECT 'emisores' AS tabla, e.id::varchar, e.nit, e.departamento_codigo, e.municipio_codigo, e.distrito_codigo
FROM emisores e
WHERE e.departamento_codigo IS NOT NULL
  AND (
    NOT EXISTS (
      SELECT 1 FROM cat_005_departamentos d
      WHERE d.codigo = e.departamento_codigo AND COALESCE(d.activo, TRUE) = TRUE
    )
    OR NOT EXISTS (
      SELECT 1 FROM cat_006_municipios m
      WHERE m.codigo = e.municipio_codigo
        AND m.departamento_codigo = e.departamento_codigo
        AND COALESCE(m.activo, TRUE) = TRUE
    )
    OR (
      e.distrito_codigo IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM cat_006_municipios m
        INNER JOIN cat_008_distritos di ON di.municipio_id = m.id
        WHERE m.codigo = e.municipio_codigo
          AND m.departamento_codigo = e.departamento_codigo
          AND di.codigo = e.distrito_codigo
          AND COALESCE(di.activo, TRUE) = TRUE
      )
    )
  )

UNION ALL

SELECT 'clientes' AS tabla, c.id::varchar, c.numero_documento, c.departamento_codigo, c.municipio_codigo, c.distrito_codigo
FROM clientes c
WHERE c.departamento_codigo IS NOT NULL
  AND (
    NOT EXISTS (
      SELECT 1 FROM cat_005_departamentos d
      WHERE d.codigo = c.departamento_codigo AND COALESCE(d.activo, TRUE) = TRUE
    )
    OR NOT EXISTS (
      SELECT 1 FROM cat_006_municipios m
      WHERE m.codigo = c.municipio_codigo
        AND m.departamento_codigo = c.departamento_codigo
        AND COALESCE(m.activo, TRUE) = TRUE
    )
    OR (
      c.distrito_codigo IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM cat_006_municipios m
        INNER JOIN cat_008_distritos di ON di.municipio_id = m.id
        WHERE m.codigo = c.municipio_codigo
          AND m.departamento_codigo = c.departamento_codigo
          AND di.codigo = c.distrito_codigo
          AND COALESCE(di.activo, TRUE) = TRUE
      )
    )
  );
