-- CAT-013 v1.1: codigo oficial de 4 digitos (depto + municipio) como referencia.
-- En JSON DTE: departamento = 2 digitos, municipio = ultimos 2 digitos de codigo_dte.

ALTER TABLE cat_006_municipios
  ADD COLUMN IF NOT EXISTS codigo_dte VARCHAR(4);

-- La Libertad (05) — fuente listasal / reorganizacion territorial v1.1
UPDATE cat_006_municipios SET codigo_dte = '0501' WHERE departamento_codigo = '05' AND nombre ILIKE '%ANTIGUO CUSCATL%';
UPDATE cat_006_municipios SET codigo_dte = '0505' WHERE departamento_codigo = '05' AND nombre ILIKE '%CHILTIUP%';
UPDATE cat_006_municipios SET codigo_dte = '0502' WHERE departamento_codigo = '05' AND nombre ILIKE '%CIUDAD ARCE%';
UPDATE cat_006_municipios SET codigo_dte = '0503' WHERE departamento_codigo = '05' AND nombre ILIKE '%COLÓN%' OR (departamento_codigo = '05' AND nombre ILIKE '%COLON%');
UPDATE cat_006_municipios SET codigo_dte = '0504' WHERE departamento_codigo = '05' AND nombre ILIKE '%COMASAGUA%';
UPDATE cat_006_municipios SET codigo_dte = '0506' WHERE departamento_codigo = '05' AND nombre ILIKE '%HUIZ%';
UPDATE cat_006_municipios SET codigo_dte = '0507' WHERE departamento_codigo = '05' AND nombre ILIKE '%JAYAQUE%';
UPDATE cat_006_municipios SET codigo_dte = '0508' WHERE departamento_codigo = '05' AND nombre ILIKE '%JICALAPA%';
UPDATE cat_006_municipios SET codigo_dte = '0509' WHERE departamento_codigo = '05' AND nombre = 'LA LIBERTAD';
UPDATE cat_006_municipios SET codigo_dte = '0510' WHERE departamento_codigo = '05' AND nombre ILIKE '%NUEVO CUSCATL%';
UPDATE cat_006_municipios SET codigo_dte = '0511' WHERE departamento_codigo = '05' AND nombre ILIKE '%SANTA TECLA%';
UPDATE cat_006_municipios SET codigo_dte = '0512' WHERE departamento_codigo = '05' AND nombre ILIKE '%QUETZALTEPEQUE%';
UPDATE cat_006_municipios SET codigo_dte = '0513' WHERE departamento_codigo = '05' AND nombre ILIKE '%SACACOYO%';
UPDATE cat_006_municipios SET codigo_dte = '0514' WHERE departamento_codigo = '05' AND nombre ILIKE '%SAN JOSÉ VILLANUEVA%' OR (departamento_codigo = '05' AND nombre ILIKE '%SAN JOSE VILLANUEVA%');
UPDATE cat_006_municipios SET codigo_dte = '0515' WHERE departamento_codigo = '05' AND nombre ILIKE '%SAN JUAN OPICO%';
UPDATE cat_006_municipios SET codigo_dte = '0516' WHERE departamento_codigo = '05' AND nombre ILIKE '%SAN MAT%';
UPDATE cat_006_municipios SET codigo_dte = '0517' WHERE departamento_codigo = '05' AND nombre ILIKE '%SAN PABLO TACACHICO%';
UPDATE cat_006_municipios SET codigo_dte = '0518' WHERE departamento_codigo = '05' AND nombre ILIKE '%TAMANIQUE%';
UPDATE cat_006_municipios SET codigo_dte = '0519' WHERE departamento_codigo = '05' AND nombre ILIKE '%TALNIQUE%';
UPDATE cat_006_municipios SET codigo_dte = '0520' WHERE departamento_codigo = '05' AND nombre ILIKE '%TEOTEPEQUE%';
UPDATE cat_006_municipios SET codigo_dte = '0521' WHERE departamento_codigo = '05' AND nombre ILIKE '%TEPECOYO%';
UPDATE cat_006_municipios SET codigo_dte = '0522' WHERE departamento_codigo = '05' AND nombre ILIKE '%ZARAGOZA%';

-- San Salvador (06)
UPDATE cat_006_municipios SET codigo_dte = '0601' WHERE departamento_codigo = '06' AND nombre ILIKE '%AGUILAR%';
UPDATE cat_006_municipios SET codigo_dte = '0602' WHERE departamento_codigo = '06' AND nombre ILIKE '%APOPA%';
UPDATE cat_006_municipios SET codigo_dte = '0603' WHERE departamento_codigo = '06' AND nombre ILIKE '%AYUTUXTEPEQUE%';
UPDATE cat_006_municipios SET codigo_dte = '0604' WHERE departamento_codigo = '06' AND nombre ILIKE '%CUSCATANCINGO%';
UPDATE cat_006_municipios SET codigo_dte = '0619' WHERE departamento_codigo = '06' AND nombre ILIKE '%DELGADO%';
UPDATE cat_006_municipios SET codigo_dte = '0605' WHERE departamento_codigo = '06' AND nombre ILIKE '%EL PAISNAL%';
UPDATE cat_006_municipios SET codigo_dte = '0606' WHERE departamento_codigo = '06' AND nombre ILIKE '%GUAZAPA%';
UPDATE cat_006_municipios SET codigo_dte = '0607' WHERE departamento_codigo = '06' AND nombre ILIKE '%ILOPANGO%';
UPDATE cat_006_municipios SET codigo_dte = '0608' WHERE departamento_codigo = '06' AND nombre ILIKE '%MEJICANOS%';
UPDATE cat_006_municipios SET codigo_dte = '0609' WHERE departamento_codigo = '06' AND nombre ILIKE '%NEJAPA%';
UPDATE cat_006_municipios SET codigo_dte = '0610' WHERE departamento_codigo = '06' AND nombre ILIKE '%PANCHIMALCO%';
UPDATE cat_006_municipios SET codigo_dte = '0611' WHERE departamento_codigo = '06' AND nombre ILIKE '%ROSARIO DE MORA%';
UPDATE cat_006_municipios SET codigo_dte = '0612' WHERE departamento_codigo = '06' AND nombre ILIKE '%SAN MARCOS%';
UPDATE cat_006_municipios SET codigo_dte = '0613' WHERE departamento_codigo = '06' AND nombre ILIKE '%SAN MART%';
UPDATE cat_006_municipios SET codigo_dte = '0614' WHERE departamento_codigo = '06' AND (nombre ILIKE '%SAN SALVADOR%' AND nombre NOT ILIKE '%NUEVA%');
UPDATE cat_006_municipios SET codigo_dte = '0615' WHERE departamento_codigo = '06' AND nombre ILIKE '%SANTIAGO TEXACUANGOS%';
UPDATE cat_006_municipios SET codigo_dte = '0616' WHERE departamento_codigo = '06' AND nombre ILIKE '%SANTO TOM%';
UPDATE cat_006_municipios SET codigo_dte = '0617' WHERE departamento_codigo = '06' AND nombre ILIKE '%SOYAPANGO%';
UPDATE cat_006_municipios SET codigo_dte = '0618' WHERE departamento_codigo = '06' AND nombre ILIKE '%TONACATEPEQUE%';

-- Fallback: concatenar depto + codigo interno (legacy)
UPDATE cat_006_municipios
SET codigo_dte = departamento_codigo || LPAD(RIGHT(codigo, 2), 2, '0')
WHERE codigo_dte IS NULL OR BTRIM(codigo_dte) = '';

CREATE INDEX IF NOT EXISTS idx_cat_006_codigo_dte ON cat_006_municipios(codigo_dte);

-- Verificacion util
-- SELECT departamento_codigo, codigo, codigo_dte, nombre FROM cat_006_municipios WHERE departamento_codigo IN ('05','06') ORDER BY 1,3;
