-- Verifica emisores/clientes contra catalogos planos (codigo + valor).
SELECT 'emisores' AS tabla, e.id::varchar, e.nit, e.departamento_codigo, e.municipio_codigo, e.distrito_codigo
FROM emisores e
WHERE e.departamento_codigo IS NOT NULL
  AND (
    NOT EXISTS (
      SELECT 1 FROM cat_012_departamento d
      WHERE d.codigo = e.departamento_codigo
    )
    OR NOT EXISTS (
      SELECT 1 FROM cat_013_municipio m
      WHERE m.codigo = e.municipio_codigo
    )
    OR (
      e.distrito_codigo IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM cat_008_distrito di
        WHERE di.codigo = e.departamento_codigo || e.distrito_codigo
      )
    )
  );

SELECT 'clientes' AS tabla, c.id::varchar, c.numero_documento, c.departamento_codigo, c.municipio_codigo, c.distrito_codigo
FROM clientes c
WHERE c.departamento_codigo IS NOT NULL
  AND (
    NOT EXISTS (
      SELECT 1 FROM cat_012_departamento d
      WHERE d.codigo = c.departamento_codigo
    )
    OR NOT EXISTS (
      SELECT 1 FROM cat_013_municipio m
      WHERE m.codigo = c.municipio_codigo
    )
    OR (
      c.distrito_codigo IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM cat_008_distrito di
        WHERE di.codigo = c.departamento_codigo || c.distrito_codigo
      )
    )
  );
