-- ============================================================
-- SCRIPT DE CORRECCIÓN: CATÁLOGOS DE UBICACIÓN
-- Estructura corregida: 2 dígitos por nivel con relaciones
-- ============================================================

-- ============================================================
-- ELIMINAR TABLAS ANTIGUAS (mantener estructura)
-- ============================================================
DROP TABLE IF EXISTS cat_006_municipios CASCADE;
DROP TABLE IF EXISTS cat_008_distritos CASCADE;

-- ============================================================
-- CAT-006: MUNICIPIOS (Versión Corregida)
-- Código: 2 dígitos únicos por departamento
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_006_municipios (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) NOT NULL, -- Solo 2 dígitos (01-30)
    departamento_codigo VARCHAR(2) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (departamento_codigo) REFERENCES cat_005_departamentos(codigo),
    UNIQUE(codigo, departamento_codigo) -- Único por departamento
);

-- ============================================================
-- CAT-008: DISTRITOS (Versión Corregida)
-- Código: 2 dígitos únicos por municipio
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_008_distritos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) NOT NULL, -- Solo 2 dígitos (01-30)
    municipio_id INTEGER NOT NULL,
    municipio_codigo VARCHAR(2) NOT NULL,
    departamento_codigo VARCHAR(2) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (municipio_id) REFERENCES cat_006_municipios(id),
    FOREIGN KEY (departamento_codigo) REFERENCES cat_005_departamentos(codigo),
    UNIQUE(codigo, municipio_id) -- Único por municipio
);

-- ============================================================
-- INSERTAR MUNICIPIOS CON ESTRUCTURA CORRECTA
-- ============================================================

-- La Libertad (05)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '05', 'SANTA TECLA'),
('02', '05', 'NUEVO CUSCATLÁN'),
('03', '05', 'CHILTIUPÁN'),
('04', '05', 'ANTIGUO CUSCATLÁN'),
('05', '05', 'LA LIBERTAD'),
('06', '05', 'NEJAPA'),
('07', '05', 'QUETZALTEPEQUE'),
('08', '05', 'TEPECOYO'),
('09', '05', 'TALNIQUE'),
('10', '05', 'SOYAPANGO'),
('11', '05', 'CIUDAD ARCE'),
('12', '05', 'COLÓN'),
('13', '05', 'TAMANIQUE'),
('14', '05', 'APOPA'),
('15', '05', 'OJUTLA'),
('16', '05', 'PUENTE DE ORO'),
('17', '05', 'JAYAQUE'),
('18', '05', 'ZARAGOZA'),
('19', '05', 'SANTO DOMINGO'),
('20', '05', 'SAN JUAN OPICO')
ON CONFLICT DO NOTHING;

-- San Miguel (12)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '12', 'SAN MIGUEL'),
('02', '12', 'SAN RAFAEL ORIENTE'),
('03', '12', 'SANTIAGO DE MARÍA'),
('04', '12', 'CHIRILAGUA'),
('05', '12', 'EL TRÁNSITO'),
('06', '12', 'MONCAGUA'),
('07', '12', 'NUEVA GUADALUPE'),
('08', '12', 'CIUDAD BARRIO'),
('09', '12', 'SAN LUIS'),
('10', '12', 'SAN CARLOS'),
('11', '12', 'NUEVO EDÉN DE JUAN DÍAZ'),
('12', '12', 'SAN GERARDO'),
('13', '12', 'JUCUAPA'),
('14', '12', 'CHINAMECA'),
('15', '12', 'JUCUARÁN')
ON CONFLICT DO NOTHING;

-- San Salvador (06)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '06', 'SAN SALVADOR'),
('02', '06', 'APOPA'),
('03', '06', 'CUSCATANCINGO'),
('04', '06', 'DELGADO'),
('05', '06', 'GUACHAPALI'),
('06', '06', 'ILOPANGO'),
('07', '06', 'MEJICANOS'),
('08', '06', 'PANCHIMALCO'),
('09', '06', 'SAN MARTÍN'),
('10', '06', 'SANTO DOMINGO DE GUZMÁN'),
('11', '06', 'SOYAPANGO'),
('12', '06', 'TONACATEPEQUE')
ON CONFLICT DO NOTHING;

-- Ahuachapán (01)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '01', 'AHUACHAPÁN'),
('02', '01', 'ATIQUIZAYA'),
('03', '01', 'CONCEPCIÓN DE ATACO'),
('04', '01', 'EL FUGARO'),
('05', '01', 'JUJUTLA'),
('06', '01', 'TACUBA'),
('07', '01', 'TURÍN')
ON CONFLICT DO NOTHING;

-- Sonsonate (02)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '02', 'SONSONATE'),
('02', '02', 'ACAJUTLA'),
('03', '02', 'CALUCO'),
('04', '02', 'IZALCO'),
('05', '02', 'NAHUIZALCO'),
('06', '02', 'SALCOATITÁN'),
('07', '02', 'SANTA CATARINA MASAHUAT'),
('08', '02', 'SANTO DOMINGO')
ON CONFLICT DO NOTHING;

-- Santa Ana (03)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '03', 'SANTA ANA'),
('02', '03', 'CANDELARIA DE LA FRONTERA'),
('03', '03', 'COATEPEQUE'),
('04', '03', 'EL CONGO'),
('05', '03', 'CHALCHUAPA'),
('06', '03', 'METAPÁN'),
('07', '03', 'SANTA ROSA GUACHIPILÍN'),
('08', '03', 'SANTIAGO TEXACUANGOS')
ON CONFLICT DO NOTHING;

-- Chalatenango (04)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '04', 'CHALATENANGO'),
('02', '04', 'AGUA CALIENTE'),
('03', '04', 'ARCATAO'),
('04', '04', 'CITALÁ'),
('05', '04', 'CONCEPCIÓN QUEZALTEPEQUE'),
('06', '04', 'DULCE NOMBRE DE MARÍA'),
('07', '04', 'EL PARAÍSO'),
('08', '04', 'LA LAGUNA'),
('09', '04', 'LA PALMA'),
('10', '04', 'NOMBRE DE JESÚS'),
('11', '04', 'NUEVA TRINIDAD'),
('12', '04', 'OJOS DE AGUA'),
('13', '04', 'POTONICO'),
('14', '04', 'SAN ANTONIO LA PAZ'),
('15', '04', 'SAN FERNANDO'),
('16', '04', 'SAN FRANCISCO LEMPA'),
('17', '04', 'SAN IGNACIO'),
('18', '04', 'SAN ISIDRO LABRADOR'),
('19', '04', 'SAN MIGUEL DE MERCEDES'),
('20', '04', 'SANTA RÍA'),
('21', '04', 'TEJUTLA'),
ON CONFLICT DO NOTHING;

-- Cuscatlán (07) - NOTA: 11 es incorrecto, debe ser 07
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '07', 'CUSCATLÁN'),
('02', '07', 'CANDELARIA'),
('03', '07', 'EL PARAÍSO'),
('04', '07', 'MONTE SAN JUAN'),
('05', '07', 'OHMECAQUE'),
('06', '07', 'SANTA CRUZ MICHAPA'),
('07', '07', 'SANTA CRUZ VIEJONES'),
('08', '07', 'SUCHITOTO'),
('09', '07', 'TENANCINGO'),
ON CONFLICT DO NOTHING;

-- Cabañas (08)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '08', 'CABAÑAS'),
('02', '08', 'CINQUERA'),
('03', '08', 'GUACOTECTI'),
('04', '08', 'ILOBASCO'),
('05', '08', 'JUTIAPA'),
('06', '08', 'SAN ISIDRO'),
ON CONFLICT DO NOTHING;

-- San Vicente (09)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '09', 'SAN VICENTE'),
('02', '09', 'APASTEPEQUE'),
('03', '09', 'BERLIN'),
('04', '09', 'CIUDADELA'),
('05', '09', 'GUADALUPE'),
('06', '09', 'LAGUNA DE LA PAZ'),
('07', '09', 'SANTO DOMINGO'),
('08', '09', 'SAN SEBASTIÁN'),
('09', '09', 'TECOLUCA'),
ON CONFLICT DO NOTHING;

-- La Paz (10)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '10', 'LA PAZ'),
('02', '10', 'CUYULTITÁN'),
('03', '10', 'EL ROSARIO'),
('04', '10', 'JERUSALÉN'),
('05', '10', 'OLOCUILTA'),
('06', '10', 'PARAÍSO DE OSORIO'),
('07', '10', 'SAN LUIS TALPA'),
('08', '10', 'SAN PABLO TACACHICO'),
('09', '10', 'SAN PEDRO MASAHUAT'),
('10', '10', 'SAN RAFAEL CEDROS'),
('11', '10', 'SANTA MARÍA OSTUMA'),
('12', '10', 'SANTIAGO NONUALCO'),
('13', '10', 'SANTO DOMINGO'),
('14', '10', 'SAN JUAN NONUALCO'),
ON CONFLICT DO NOTHING;

-- Usulután (11)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '11', 'USULUTÁN'),
('02', '11', 'ALEGRÍA'),
('03', '11', 'BERLIN'),
('04', '11', 'CALIFORNIA'),
('05', '11', 'CONCEPCIÓN BATRES'),
('06', '11', 'EREGUAYQUÍN'),
('07', '11', 'ESTANZUELAS'),
('08', '11', 'JIQUILISCO'),
('09', '11', 'JUCUAPA'),
('10', '11', 'JUCUARÁN'),
('11', '11', 'MERCEDES UMAÑA'),
('12', '11', 'NUEVA GUADALUPE'),
('13', '11', 'PUERTO EL TRIUNFO'),
('14', '11', 'SAN ALEJO'),
('15', '11', 'SAN BUENAVENTURA'),
('16', '11', 'SANTA ELENA'),
('17', '11', 'SANTIAGO DE MARÍA'),
('18', '11', 'SANTA MARÍA'),
ON CONFLICT DO NOTHING;

-- Morazán (13)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '13', 'SAN FRANCISCO GOTERA'),
('02', '13', 'ARAMBALA'),
('03', '13', 'CACAOPERA'),
('04', '13', 'CHILANGA'),
('05', '13', 'CORINTO'),
('06', '13', 'GUACHAPALI'),
('07', '13', 'JOCORO'),
('08', '13', 'JOCOAITIQUE'),
('09', '13', 'MEANGUERA'),
('10', '13', 'OSICALA'),
('11', '13', 'PERQUÍN'),
('12', '13', 'SAN CARLOS'),
('13', '13', 'SAN FERNANDO'),
('14', '13', 'SENSUNTEPEQUE'),
('15', '13', 'SOCIEDAD'),
ON CONFLICT DO NOTHING;

-- La Unión (14)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
('01', '14', 'LA UNIÓN'),
('02', '14', 'ANAMOROS'),
('03', '14', 'BOLÍVAR'),
('04', '14', 'CONCEPCEPCIÓN DE ORO'),
('05', '14', 'EL CARMEN'),
('06', '14', 'EL SAUCE'),
('07', '14', 'INTIPUCÁ'),
('08', '14', 'JUCUARÁN'),
('09', '14', 'LISLIQUE'),
('10', '14', 'MEANGUERA'),
('11', '14', 'NUEVA ESPARTA'),
('12', '14', 'PASAQUINA'),
('13', '14', 'POLORÓS'),
('14', '14', 'SAN ALEJO'),
('15', '14', 'SAN JOSÉ LA FUENTE'),
('16', '14', 'SANTA ROSA DE LIMA'),
('17', '14', 'YAYANTIQUE'),
ON CONFLICT DO NOTHING;

-- ============================================================
-- INSERTAR DISTRITOS (Cadena: Municipio → Distritos)
-- ============================================================
-- Los distritos ahora están vinculados a municipios específicos
-- Nota: La estructura de distritos por municipio varía en la práctica
-- Esta es una estructura simplificada para ejemplo

-- Distritos para Santa Tecla (La Libertad - 01-05)
INSERT INTO cat_008_distritos (codigo, municipio_id, municipio_codigo, departamento_codigo, nombre) 
SELECT '01', id, '01', '05', 'Distrito Central' FROM cat_006_municipios WHERE codigo='01' AND departamento_codigo='05'
ON CONFLICT DO NOTHING;

INSERT INTO cat_008_distritos (codigo, municipio_id, municipio_codigo, departamento_codigo, nombre) 
SELECT '02', id, '01', '05', 'Distrito 2' FROM cat_006_municipios WHERE codigo='01' AND departamento_codigo='05'
ON CONFLICT DO NOTHING;

INSERT INTO cat_008_distritos (codigo, municipio_id, municipio_codigo, departamento_codigo, nombre) 
SELECT '03', id, '01', '05', 'Distrito 3' FROM cat_006_municipios WHERE codigo='01' AND departamento_codigo='05'
ON CONFLICT DO NOTHING;

-- Distritos para San Miguel (San Miguel - 01-12)
INSERT INTO cat_008_distritos (codigo, municipio_id, municipio_codigo, departamento_codigo, nombre) 
SELECT '01', id, '01', '12', 'Distrito Central' FROM cat_006_municipios WHERE codigo='01' AND departamento_codigo='12'
ON CONFLICT DO NOTHING;

INSERT INTO cat_008_distritos (codigo, municipio_id, municipio_codigo, departamento_codigo, nombre) 
SELECT '02', id, '01', '12', 'Distrito 2' FROM cat_006_municipios WHERE codigo='01' AND departamento_codigo='12'
ON CONFLICT DO NOTHING;

-- ============================================================
-- CREAR ÍNDICES DE BÚSQUEDA
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cat_006_municipios_dept ON cat_006_municipios(departamento_codigo);
CREATE INDEX IF NOT EXISTS idx_cat_006_municipios_codigo ON cat_006_municipios(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_006_municipios_unico ON cat_006_municipios(codigo, departamento_codigo);

CREATE INDEX IF NOT EXISTS idx_cat_008_distritos_municipio ON cat_008_distritos(municipio_id);
CREATE INDEX IF NOT EXISTS idx_cat_008_distritos_codigo ON cat_008_distritos(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_008_distritos_departamento ON cat_008_distritos(departamento_codigo);
CREATE INDEX IF NOT EXISTS idx_cat_008_distritos_unico ON cat_008_distritos(codigo, municipio_id);

-- ============================================================
-- VISTA PARA CASCADA DE SELECCIÓN
-- ============================================================
CREATE OR REPLACE VIEW vista_ubicacion_cascada AS
SELECT 
    d.codigo AS departamento_codigo,
    d.nombre AS departamento_nombre,
    m.codigo AS municipio_codigo,
    m.nombre AS municipio_nombre,
    di.codigo AS distrito_codigo,
    di.nombre AS distrito_nombre,
    di.id AS distrito_id
FROM cat_005_departamentos d
LEFT JOIN cat_006_municipios m ON d.codigo = m.departamento_codigo
LEFT JOIN cat_008_distritos di ON m.id = di.municipio_id
WHERE d.activo = TRUE
    AND (m.activo = TRUE OR m.activo IS NULL)
    AND (di.activo = TRUE OR di.activo IS NULL)
ORDER BY d.codigo, m.codigo, di.codigo;

-- ============================================================
-- AUDITORÍA
-- ============================================================
INSERT INTO audit_log (tabla, operacion, usuario, descripcion, cantidad_registros) 
VALUES ('CATÁLOGOS_UBICACIÓN', 'CORRECCIÓN', 'admin', 'Restructuración de municipios y distritos (2 dígitos c/u)', 2)
ON CONFLICT DO NOTHING;
