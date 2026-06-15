-- ============================================================
-- Corrige la ubicacion del emisor (Santa Tecla) segun catalogo OFICIAL MH.
-- Santa Tecla pertenece al municipio CAT-013 "LA LIBERTAD SUR" = 28 (dept 05).
-- Distrito (CAT-008, antiguo municipio) Santa Tecla = 01.
--
-- IMPORTANTE: ejecutar PRIMERO scripts/fix-cat013-oficial.sql para recrear
-- cat_013_municipio con codigos por departamento.
-- ============================================================
UPDATE emisores
SET
  departamento_codigo = '05',
  municipio_codigo = '28',
  distrito_codigo = '01'
WHERE complemento_direccion ILIKE '%SANTA TECLA%'
   OR complemento_direccion ILIKE '%LA LIBERTAD%';

-- Verificacion
SELECT id, nombre, departamento_codigo, municipio_codigo, distrito_codigo, complemento_direccion
FROM emisores
WHERE departamento_codigo = '05';
