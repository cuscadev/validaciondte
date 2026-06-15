-- ============================================================
-- CAT-013 Municipio OFICIAL (Ministerio de Hacienda)
-- Generado por scripts/generate-cat013-oficial.mjs
-- IMPORTANTE: el codigo de municipio es unico SOLO dentro del departamento.
-- La clave real es (departamento_codigo, codigo).
-- ============================================================

DROP TABLE IF EXISTS cat_013_municipio CASCADE;

CREATE TABLE cat_013_municipio (
    id SERIAL PRIMARY KEY,
    departamento_codigo VARCHAR(2) NOT NULL,
    codigo VARCHAR(2) NOT NULL,
    valor TEXT NOT NULL,
    UNIQUE (departamento_codigo, codigo)
);

INSERT INTO cat_013_municipio (departamento_codigo, codigo, valor) VALUES
('01', '13', 'AHUACHAPAN NORTE'),
('01', '14', 'AHUACHAPAN CENTRO'),
('01', '15', 'AHUACHAPAN SUR'),
('02', '14', 'SANTA ANA NORTE'),
('02', '15', 'SANTA ANA CENTRO'),
('02', '16', 'SANTA ANA ESTE'),
('02', '17', 'SANTA ANA OESTE'),
('03', '17', 'SONSONATE NORTE'),
('03', '18', 'SONSONATE CENTRO'),
('03', '19', 'SONSONATE ESTE'),
('03', '20', 'SONSONATE OESTE'),
('04', '34', 'CHALATENANGO NORTE'),
('04', '35', 'CHALATENANGO CENTRO'),
('04', '36', 'CHALATENANGO SUR'),
('05', '23', 'LA LIBERTAD NORTE'),
('05', '24', 'LA LIBERTAD CENTRO'),
('05', '25', 'LA LIBERTAD OESTE'),
('05', '26', 'LA LIBERTAD ESTE'),
('05', '27', 'LA LIBERTAD COSTA'),
('05', '28', 'LA LIBERTAD SUR'),
('06', '20', 'SAN SALVADOR NORTE'),
('06', '21', 'SAN SALVADOR OESTE'),
('06', '22', 'SAN SALVADOR ESTE'),
('06', '23', 'SAN SALVADOR CENTRO'),
('06', '24', 'SAN SALVADOR SUR'),
('07', '17', 'CUSCATLAN NORTE'),
('07', '18', 'CUSCATLAN SUR'),
('08', '23', 'LA PAZ OESTE'),
('08', '24', 'LA PAZ CENTRO'),
('08', '25', 'LA PAZ ESTE'),
('09', '10', 'CABANAS OESTE'),
('09', '11', 'CABANAS ESTE'),
('10', '14', 'SAN VICENTE NORTE'),
('10', '15', 'SAN VICENTE SUR'),
('11', '24', 'USULUTAN NORTE'),
('11', '25', 'USULUTAN ESTE'),
('11', '26', 'USULUTAN OESTE'),
('12', '21', 'SAN MIGUEL NORTE'),
('12', '22', 'SAN MIGUEL CENTRO'),
('12', '23', 'SAN MIGUEL OESTE'),
('13', '27', 'MORAZAN NORTE'),
('13', '28', 'MORAZAN SUR'),
('14', '19', 'LA UNION NORTE'),
('14', '20', 'LA UNION SUR');

CREATE INDEX IF NOT EXISTS idx_cat_013_dept ON cat_013_municipio(departamento_codigo);
