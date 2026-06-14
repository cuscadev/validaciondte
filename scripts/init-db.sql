-- ============================================================
-- BASE DE DATOS DE CATÁLOGOS DE FACTURACIÓN ELECTRÓNICA
-- El Salvador - Ministerio de Hacienda
-- Catálogos CAT-001 a CAT-033
-- ============================================================

-- ============================================================
-- CAT-001: AMBIENTE
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_001_ambiente (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_001_ambiente (codigo, nombre, descripcion) VALUES
('00', 'PRODUCCIÓN', 'Ambiente de Producción'),
('01', 'PRUEBAS', 'Ambiente de Pruebas')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-002: VERSIÓN DEL FORMATO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_002_version_formato (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(3) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_002_version_formato (codigo, nombre, descripcion) VALUES
('1', 'Versión 1.0', 'Formato inicial de DTE'),
('2', 'Versión 2.0', 'Formato mejorado con validaciones'),
('3', 'Versión 3.0', 'Formato actual con soporte de exportación'),
('4', 'Versión 4.0', 'Formato con nuevas funcionalidades')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-003: TIPO DE DOCUMENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_003_tipo_documento (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_003_tipo_documento (codigo, nombre, descripcion) VALUES
('01', 'NIT', 'Número de Identificación Tributaria'),
('02', 'DUI', 'Documento Único de Identidad'),
('03', 'PASAPORTE', 'Pasaporte'),
('04', 'OTRO', 'Otro Documento'),
('05', 'CÉDULA EXTRANJERA', 'Cédula de Extranjería'),
('36', 'NIT (Jurídica)', 'Número de Identificación Tributaria - Persona Jurídica')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-004: MONEDAS
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_004_monedas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(3) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    simbolo VARCHAR(5),
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_004_monedas (codigo, nombre, simbolo, descripcion) VALUES
('USD', 'DÓLAR ESTADOUNIDENSE', '$', 'Dólar de Estados Unidos'),
('SVC', 'COLÓN SALVADOREÑO', '₡', 'Colón de El Salvador'),
('EUR', 'EURO', '€', 'Euro de la Unión Europea'),
('MXN', 'PESO MEXICANO', '$', 'Peso Mexicano'),
('GTQ', 'QUETZAL', 'Q', 'Quetzal Guatemalteco'),
('HNL', 'LEMPIRA', 'L', 'Lempira Hondureña'),
('NIO', 'CÓRDOBA', 'C$', 'Córdoba Nicaragüense'),
('CRC', 'COLÓN COSTARRICENSE', '₡', 'Colón Costarricense'),
('PAB', 'BALBOA', 'B/.', 'Balboa Panameño'),
('GBP', 'LIBRA ESTERLINA', '£', 'Libra Esterlina'),
('JPY', 'YEN JAPONÉS', '¥', 'Yen Japonés'),
('CAD', 'DÓLAR CANADIENSE', 'C$', 'Dólar Canadiense'),
('CHF', 'FRANCO SUIZO', 'CHF', 'Franco Suizo'),
('CNY', 'YUAN CHINO', '¥', 'Yuan Chino'),
('AUD', 'DÓLAR AUSTRALIANO', '$', 'Dólar Australiano')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-005: DEPARTAMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_005_departamentos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_005_departamentos (codigo, nombre) VALUES
('01', 'AHUACHAPÁN'),
('02', 'SONSONATE'),
('03', 'SANTA ANA'),
('04', 'CHALATENANGO'),
('05', 'LA LIBERTAD'),
('06', 'SAN SALVADOR'),
('07', 'CUSCATLÁN'),
('08', 'CABAÑAS'),
('09', 'SAN VICENTE'),
('10', 'LA PAZ'),
('11', 'USULUTÁN'),
('12', 'SAN MIGUEL'),
('13', 'MORAZÁN'),
('14', 'LA UNIÓN')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-006: MUNICIPIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_006_municipios (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(4) UNIQUE NOT NULL,
    departamento_codigo VARCHAR(2) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (departamento_codigo) REFERENCES cat_005_departamentos(codigo)
);

-- Insertando municipios principales (select from)
INSERT INTO cat_006_municipios (codigo, departamento_codigo, nombre) VALUES
-- La Libertad (05)
('0501', '05', 'SANTA TECLA'),
('0502', '05', 'NUEVO CUSCATLÁN'),
('0503', '05', 'CHILTIUPÁN'),
('0504', '05', 'ANTIGUO CUSCATLÁN'),
('0505', '05', 'LA LIBERTAD'),
('0506', '05', 'NEJAPA'),
('0507', '05', 'QUETZALTEPEQUE'),
('0508', '05', 'TEPECOYO'),
('0509', '05', 'TALNIQUE'),
('0510', '05', 'SOYAPANGO'),
('0511', '05', 'CIUDAD ARCE'),
('0512', '05', 'COLÓN'),
('0513', '05', 'TAMANIQUE'),
('0514', '05', 'APOPA'),
('0515', '05', 'OJUTLA'),
('0516', '05', 'PUENTE DE ORO'),
('0517', '05', 'JAYAQUE'),
('0518', '05', 'ZARAGOZA'),
('0519', '05', 'SANTO DOMINGO'),
('0520', '05', 'SAN JUAN OPICO'),
-- San Miguel (12)
('1201', '12', 'SAN MIGUEL'),
('1202', '12', 'SAN RAFAEL ORIENTE'),
('1203', '12', 'SANTIAGO DE MARÍA'),
('1204', '12', 'CHIRILAGUA'),
('1205', '12', 'EL TRÁNSITO'),
('1206', '12', 'MONCAGUA'),
('1207', '12', 'NUEVA GUADALUPE'),
('1208', '12', 'CIUDAD BARRIO'),
('1209', '12', 'SAN LUIS'),
('1210', '12', 'SAN CARLOS'),
('1211', '12', 'NUEVO EDÉN DE JUAN DÍAZ'),
('1212', '12', 'SAN GERARDO'),
('1213', '12', 'JUCUAPA'),
('1214', '12', 'CHINAMECA'),
('1215', '12', 'JUCUARÁN'),
-- San Salvador (06)
('0601', '06', 'SAN SALVADOR'),
('0602', '06', 'APOPA'),
('0603', '06', 'CUSCATANCINGO'),
('0604', '06', 'DELGADO'),
('0605', '06', 'GUACHAPALI'),
('0606', '06', 'ILOPANGO'),
('0607', '06', 'MEJICANOS'),
('0608', '06', 'PANCHIMALCO'),
('0609', '06', 'SAN MARTÍN'),
('0610', '06', 'SANTO DOMINGO DE GUZMÁN'),
('0611', '06', 'SOYAPANGO'),
('0612', '06', 'TONACATEPEQUE')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-007: TIPO DE ESTABLECIMIENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_007_tipo_establecimiento (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_007_tipo_establecimiento (codigo, nombre, descripcion) VALUES
('01', 'MATRIZ', 'Establecimiento Principal'),
('02', 'SUCURSAL', 'Sucursal de la Empresa'),
('03', 'AGENCIA', 'Agencia de Servicios')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-008: DISTRITOS
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_008_distritos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_008_distritos (codigo, nombre, descripcion) VALUES
('01', 'Distrito Central', 'Centro Urbano Principal'),
('02', 'Distrito 2', 'Segundo Distrito'),
('03', 'Distrito 3', 'Tercer Distrito'),
('04', 'Distrito 4', 'Cuarto Distrito'),
('05', 'Distrito 5', 'Quinto Distrito'),
('06', 'Distrito 6', 'Sexto Distrito'),
('07', 'Distrito 7', 'Séptimo Distrito'),
('08', 'Distrito 8', 'Octavo Distrito'),
('09', 'Distrito 9', 'Noveno Distrito'),
('10', 'Distrito 10', 'Décimo Distrito'),
('11', 'Distrito 11', 'Decimoprimer Distrito'),
('12', 'Distrito 12', 'Decimosegundo Distrito'),
('13', 'Distrito 13', 'Decimotercer Distrito'),
('14', 'Distrito 14', 'Decimocuarto Distrito'),
('15', 'Distrito 15', 'Decimoquinto Distrito'),
('16', 'Distrito 16', 'Decimosexto Distrito'),
('17', 'Distrito 17', 'Decimoséptimo Distrito'),
('18', 'Distrito 18', 'Decimoctavo Distrito'),
('19', 'Distrito 19', 'Decimonoveno Distrito'),
('20', 'Distrito 20', 'Vigésimo Distrito'),
('21', 'Distrito 21', 'Vigesimoprimer Distrito'),
('22', 'Distrito 22', 'Vigesimosegundo Distrito'),
('23', 'Distrito 23', 'Vigesimotercer Distrito'),
('24', 'Distrito 24', 'Vigesimocuarto Distrito'),
('25', 'Distrito 25', 'Vigésimoquinto Distrito'),
('26', 'Distrito 26', 'Vigesimosexto Distrito'),
('27', 'Distrito 27', 'Vigesimoséptimo Distrito'),
('28', 'Distrito 28', 'Vigesimooctavo Distrito'),
('29', 'Distrito 29', 'Vigesimonoveno Distrito'),
('30', 'Distrito 30', 'Trigésimo Distrito')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-009: TIPO DE INGRESO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_009_tipo_ingreso (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_009_tipo_ingreso (codigo, nombre, descripcion) VALUES
('01', 'VENTAS DE BIENES', 'Ingresos por venta de bienes'),
('02', 'PRESTACIÓN DE SERVICIOS', 'Ingresos por prestación de servicios'),
('03', 'ARRENDAMIENTO DE BIENES INMUEBLES', 'Ingresos por arrendamiento de bienes'),
('04', 'INGRESOS FINANCIEROS', 'Ingresos por intereses y dividendos'),
('05', 'INGRESOS POR HONORARIOS', 'Ingresos por servicios profesionales'),
('06', 'EXPORTACIÓN', 'Ingresos por exportación'),
('07', 'OTROS INGRESOS', 'Otros ingresos no clasificados')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-010: TIPO DE RETENCIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_010_tipo_retencion (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    porcentaje DECIMAL(5, 2),
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_010_tipo_retencion (codigo, nombre, porcentaje, descripcion) VALUES
('01', 'RETENCIÓN I.V.A.', 13.00, 'Retención de Impuesto al Valor Agregado'),
('02', 'RETENCIÓN I.S.R.', 10.00, 'Retención de Impuesto sobre la Renta'),
('03', 'RETENCIÓN I.R.F.', 8.00, 'Retención de Impuesto a Remesas Familiares'),
('04', 'RETENCIÓN MUNICIPAL', 1.00, 'Retención de Impuesto Municipal'),
('05', 'OTRA RETENCIÓN', 0.00, 'Otra retención fiscal')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-011: TIPO DE DOCUMENTO RELACIONADO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_011_tipo_doc_relacionado (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_011_tipo_doc_relacionado (codigo, nombre, descripcion) VALUES
('01', 'FACTURA', 'Factura relacionada'),
('02', 'COMPROBANTE DE CRÉDITO FISCAL', 'Comprobante de Crédito Fiscal'),
('03', 'NOTA DE REMISIÓN', 'Nota de Remisión'),
('04', 'NOTA DE CRÉDITO', 'Nota de Crédito'),
('05', 'NOTA DE DÉBITO', 'Nota de Débito'),
('06', 'OTRO DOCUMENTO', 'Otro Documento')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-012: TIPO DE TRANSMISIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_012_tipo_transmision (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_012_tipo_transmision (codigo, nombre, descripcion) VALUES
('01', 'NORMAL', 'Transmisión Normal de DTE'),
('02', 'CONTINGENCIA', 'Transmisión por Contingencia'),
('03', 'IMPORTACIÓN', 'Importación de Catálogos')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-013: TIPO DE DOCUMENTO TRIBUTARIO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_013_tipo_dte (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_013_tipo_dte (codigo, nombre, descripcion) VALUES
('01', 'FACTURA', 'Factura'),
('02', 'NOTA DE CRÉDITO', 'Nota de Crédito'),
('03', 'NOTA DE DÉBITO', 'Nota de Débito'),
('04', 'COMPROBANTE DE CRÉDITO FISCAL', 'Comprobante de Crédito Fiscal'),
('05', 'NOTA DE REMISIÓN', 'Nota de Remisión'),
('06', 'FACTURA CONSUMIDOR FINAL', 'Factura para Consumidor Final')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-014: TIPO DE INVALIDACIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_014_tipo_invalidacion (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_014_tipo_invalidacion (codigo, nombre, descripcion) VALUES
('01', 'ANULACIÓN POR ERROR EN LA ELABORACIÓN', 'Anulación por Error'),
('02', 'ANULACIÓN POR CONTINGENCIA DEL CONTRIBUYENTE', 'Anulación por Contingencia'),
('03', 'ANULACIÓN POR NO UTILIZACIÓN', 'Anulación por No Utilización'),
('04', 'ANULACIÓN ADMINISTRATIVA', 'Anulación Administrativa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-015: INDICADOR DE COMPROBANTE
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_015_indicador_comprobante (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_015_indicador_comprobante (codigo, nombre, descripcion) VALUES
('01', 'COMPROBANTE VÁLIDO', 'Comprobante Válido'),
('02', 'COMPROBANTE ANULADO', 'Comprobante Anulado'),
('03', 'COMPROBANTE EN CONTINGENCIA', 'Comprobante Emitido en Contingencia')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-016: TIPO DE VENTA
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_016_tipo_venta (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_016_tipo_venta (codigo, nombre, descripcion) VALUES
('01', 'CONTADO', 'Venta al Contado'),
('02', 'CRÉDITO', 'Venta a Crédito'),
('03', 'PLAZO', 'Venta a Plazo')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-017: ESTADO DE DERECHO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_017_estado_derecho (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_017_estado_derecho (codigo, nombre, descripcion) VALUES
('01', 'ACREEDOR/DEUDOR', 'Posición de acreedor o deudor'),
('02', 'NO APLICA', 'No aplica estado de derecho')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-018: INDICADOR DE COMISIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_018_indicador_comision (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_018_indicador_comision (codigo, nombre, descripcion) VALUES
('01', 'RETIENE COMISIÓN', 'El receptor retiene comisión'),
('02', 'NO RETIENE COMISIÓN', 'El receptor no retiene comisión')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-019: CÓDIGO DE INCIDENCIA
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_019_codigo_incidencia (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(3) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_019_codigo_incidencia (codigo, nombre, descripcion) VALUES
('001', 'AMBIENTE PRODUCCIÓN INACTIVO', 'El ambiente de producción está inactivo'),
('002', 'AMBIENTE PRUEBAS INACTIVO', 'El ambiente de pruebas está inactivo'),
('003', 'CERTIFICADO EXPIRADO', 'El certificado del contribuyente ha expirado'),
('004', 'DTE RECHAZADO POR HACIENDA', 'El DTE fue rechazado por Hacienda'),
('005', 'ERROR DE VALIDACIÓN', 'Error en la validación del formato'),
('006', 'RECEPTOR NO EXISTE', 'El receptor no existe en el registro'),
('007', 'VALOR NO PERMITIDO', 'Un valor no es permitido en el catálogo'),
('008', 'FORMATO INVÁLIDO', 'El formato del campo es inválido')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-020: CONDICIÓN DE OPERACIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_020_condicion_operacion (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_020_condicion_operacion (codigo, nombre, descripcion) VALUES
('01', 'OPERACIÓN NORMAL', 'Operación Normal'),
('02', 'OPERACIÓN CONTINGENCIA', 'Operación Contingencia'),
('03', 'OPERACIÓN COMBINADA', 'Operación Combinada')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-021: DESCRIPCIÓN DE OPERACIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_021_descripcion_operacion (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_021_descripcion_operacion (codigo, nombre, descripcion) VALUES
('01', 'VENTA DE BIENES', 'Venta de Bienes'),
('02', 'PRESTACIÓN DE SERVICIOS', 'Prestación de Servicios'),
('03', 'DONACIÓN', 'Donación'),
('04', 'DEVOLUCIÓN', 'Devolución'),
('05', 'COMPRA DE BIENES', 'Compra de Bienes'),
('06', 'COMPRA DE SERVICIOS', 'Compra de Servicios'),
('07', 'TRANSFERENCIA', 'Transferencia'),
('08', 'TRASPASO', 'Traspaso')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-022: TIPO DE AFILIACIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_022_tipo_afiliacion (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_022_tipo_afiliacion (codigo, nombre, descripcion) VALUES
('01', 'AFILIADO ACTIVO', 'Afiliado Activo'),
('02', 'AFILIADO INACTIVO', 'Afiliado Inactivo'),
('03', 'AFILIADO SUSPENDIDO', 'Afiliado Suspendido'),
('04', 'NO AFILIADO', 'No Afiliado')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-023: RÉGIMEN TRIBUTARIO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_023_regimen_tributario (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_023_regimen_tributario (codigo, nombre, descripcion) VALUES
('01', 'RÉGIMEN GENERAL', 'Régimen General de Contribuyentes'),
('02', 'RÉGIMEN SIMPLIFICADO', 'Régimen Simplificado'),
('03', 'RÉGIMEN DE PEQUEÑO CONTRIBUYENTE', 'Pequeño Contribuyente'),
('04', 'RÉGIMEN ESPECIAL', 'Régimen Especial')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-024: CÓDIGO DE ACTIVIDAD ECONÓMICA (ISIC v4)
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_024_codigo_actividad (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_024_codigo_actividad (codigo, nombre, descripcion) VALUES
('01100', 'CULTIVO DE CEREALES', 'Cultivo de cereales (excepto arroz), legumbres y semillas oleaginosas'),
('01200', 'CULTIVO DE HORTALIZAS', 'Cultivo de hortalizas, melones, raíces y tubérculos'),
('01300', 'CULTIVO DE PLANTAS PARA BEBIDAS', 'Cultivo de plantas para bebidas'),
('42900', 'CONSTRUCCIÓN DE OBRAS DE INGENIERÍA CIVIL', 'Construcción de obras de ingeniería civil n.c.p.'),
('45100', 'COMPRA VENTA DE VEHÍCULOS', 'Compra y venta de vehículos automotores'),
('46200', 'COMERCIO AL POR MAYOR DE MATERIALES', 'Comercio al por mayor de materiales de construcción'),
('47110', 'COMERCIO AL POR MENOR', 'Comercio al por menor en establecimientos no especializados'),
('47190', 'OTROS COMERCIOS DE MERCANCÍAS', 'Otros comercios de mercancías'),
('52290', 'OTRAS ACTIVIDADES DE TRANSPORTE', 'Otras actividades de transporte y almacenamiento'),
('58110', 'EDICIÓN Y PUBLICACIÓN DE LIBROS', 'Edición y publicación de libros'),
('62010', 'PROGRAMACIÓN INFORMÁTICA', 'Programación informática'),
('62020', 'CONSULTORÍA INFORMÁTICA', 'Consultoría informática'),
('62090', 'OTRAS ACTIVIDADES DE TIC', 'Otras actividades de tecnología de la información'),
('63110', 'PROCESAMIENTO DE DATOS', 'Procesamiento de datos, alojamiento'),
('68100', 'COMPRAVENTA DE BIENES INMUEBLES', 'Compra y venta de bienes inmuebles'),
('69101', 'SERVICIOS DE ABOGADOS', 'Servicios de abogados'),
('69102', 'SERVICIOS DE CONTADORES', 'Servicios de contadores'),
('69103', 'SERVICIOS DE INGENIEROS', 'Servicios de ingenieros'),
('70100', 'SERVICIOS DE DIRECCIÓN EMPRESARIAL', 'Servicios de dirección empresarial'),
('72110', 'INVESTIGACIÓN DESARROLLO SOFTWARE', 'Investigación y desarrollo de software'),
('73110', 'AGENCIAS DE PUBLICIDAD', 'Agencias de publicidad'),
('85111', 'EDUCACIÓN INICIAL', 'Educación inicial'),
('85112', 'EDUCACIÓN PRIMARIA', 'Educación primaria'),
('85121', 'EDUCACIÓN SECUNDARIA', 'Educación secundaria'),
('85130', 'EDUCACIÓN SUPERIOR', 'Educación superior'),
('86101', 'HOSPITALES', 'Hospitales'),
('86210', 'CLÍNICAS', 'Clínicas'),
('86900', 'OTROS SERVICIOS DE SALUD', 'Otros servicios de salud'),
('90010', 'RECOLECCIÓN DE DESECHOS', 'Actividades de recolección de desechos'),
('93010', 'ACTIVIDADES DEPORTIVAS', 'Actividades deportivas'),
('94100', 'ASOCIACIONES PROFESIONALES', 'Actividades de asociaciones profesionales')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-025: OTROS DATOS DE LA DIRECCIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_025_otros_datos_direccion (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_025_otros_datos_direccion (codigo, nombre, descripcion) VALUES
('01', 'CALLE', 'Vía de acceso - Calle'),
('02', 'AVENIDA', 'Vía de acceso - Avenida'),
('03', 'CAMINO', 'Vía de acceso - Camino'),
('04', 'CARRETERA', 'Vía de acceso - Carretera'),
('05', 'BOULEVARD', 'Vía de acceso - Boulevard'),
('06', 'PASAJE', 'Vía de acceso - Pasaje')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-026: MÉTODO DE PAGO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_026_metodo_pago (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_026_metodo_pago (codigo, nombre, descripcion) VALUES
('01', 'EFECTIVO', 'Pago en Efectivo'),
('02', 'CHEQUE', 'Pago con Cheque'),
('03', 'TARJETA DE CRÉDITO', 'Pago con Tarjeta de Crédito'),
('04', 'TARJETA DE DÉBITO', 'Pago con Tarjeta de Débito'),
('05', 'TRANSFERENCIA BANCARIA', 'Pago por Transferencia Bancaria'),
('06', 'DEPÓSITO BANCARIO', 'Pago por Depósito Bancario'),
('07', 'MONEDA EXTRANJERA', 'Pago en Moneda Extranjera'),
('08', 'OTRO', 'Otro Método de Pago')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-027: FORMA DE PAGO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_027_forma_pago (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_027_forma_pago (codigo, nombre, descripcion) VALUES
('01', 'PLAZO A 30 DÍAS', 'Plazo a 30 Días'),
('02', 'PLAZO A 60 DÍAS', 'Plazo a 60 Días'),
('03', 'PLAZO A 90 DÍAS', 'Plazo a 90 Días'),
('04', 'PLAZO A 120 DÍAS', 'Plazo a 120 Días'),
('05', 'CONTRA ENTREGA', 'Contra Entrega'),
('06', 'INMEDIATO', 'Pago Inmediato'),
('07', 'LETRA DE CAMBIO', 'Letra de Cambio'),
('08', 'PAGARÉ', 'Pagaré'),
('09', 'TRANSFERENCIA FUTURA', 'Transferencia en Fecha Futura'),
('10', 'OTRO', 'Otra Forma de Pago')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-028: PLAZO DE CRÉDITO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_028_plazo_credito (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(3) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    dias INTEGER,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_028_plazo_credito (codigo, nombre, dias, descripcion) VALUES
('001', 'INMEDIATO', 0, 'Pago inmediato (0 días)'),
('030', 'PLAZO 30 DÍAS', 30, 'Plazo de 30 días'),
('060', 'PLAZO 60 DÍAS', 60, 'Plazo de 60 días'),
('090', 'PLAZO 90 DÍAS', 90, 'Plazo de 90 días'),
('120', 'PLAZO 120 DÍAS', 120, 'Plazo de 120 días'),
('150', 'PLAZO 150 DÍAS', 150, 'Plazo de 150 días'),
('180', 'PLAZO 180 DÍAS', 180, 'Plazo de 180 días'),
('365', 'PLAZO 365 DÍAS', 365, 'Plazo de 365 días')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-029: TIPO DE PRECIO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_029_tipo_precio (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_029_tipo_precio (codigo, nombre, descripcion) VALUES
('01', 'PRECIO UNITARIO', 'Precio Unitario'),
('02', 'PRECIO TOTAL', 'Precio Total'),
('03', 'PRECIO REFERENCIAL', 'Precio Referencial'),
('04', 'PRECIO PROMOCIONAL', 'Precio Promocional'),
('05', 'PRECIO CON DESCUENTO', 'Precio con Descuento')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-030: GENERADOR DE CÓDIGO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_030_generador_codigo (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_030_generador_codigo (codigo, nombre, descripcion) VALUES
('01', 'ALEATORIO', 'Código Generado Aleatoriamente'),
('02', 'SECUENCIAL', 'Código Generado de Forma Secuencial'),
('03', 'USUARIO', 'Código Generado por el Usuario')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-031: UNIDAD DE MEDIDA
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_031_unidad_medida (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(5) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    abreviatura VARCHAR(10),
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_031_unidad_medida (codigo, nombre, abreviatura, descripcion) VALUES
('UN', 'UNIDAD', 'UN', 'Unidad'),
('KG', 'KILOGRAMO', 'KG', 'Kilogramo'),
('GR', 'GRAMO', 'GR', 'Gramo'),
('LT', 'LITRO', 'LT', 'Litro'),
('ML', 'MILILITRO', 'ML', 'Mililitro'),
('MT', 'METRO', 'MT', 'Metro'),
('CM', 'CENTÍMETRO', 'CM', 'Centímetro'),
('M2', 'METRO CUADRADO', 'M2', 'Metro Cuadrado'),
('M3', 'METRO CÚBICO', 'M3', 'Metro Cúbico'),
('HRA', 'HORA', 'HRA', 'Hora'),
('DÍA', 'DÍA', 'DÍA', 'Día'),
('MES', 'MES', 'MES', 'Mes'),
('AÑO', 'AÑO', 'AÑO', 'Año'),
('BOL', 'BOLSA', 'BOL', 'Bolsa'),
('CAJ', 'CAJA', 'CAJ', 'Caja'),
('BOT', 'BOTELLA', 'BOT', 'Botella'),
('SER', 'SERVICIO', 'SER', 'Servicio'),
('PAQ', 'PAQUETE', 'PAQ', 'Paquete'),
('PAL', 'PALETA', 'PAL', 'Paleta'),
('TN', 'TONELADA', 'TN', 'Tonelada')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-032: ESPECIFICACIÓN TÉCNICA
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_032_especificacion_tecnica (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(3) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_032_especificacion_tecnica (codigo, nombre, descripcion) VALUES
('001', 'MARCA', 'Marca del producto'),
('002', 'MODELO', 'Modelo del producto'),
('003', 'SERIE', 'Número de serie'),
('004', 'LOTE', 'Lote de fabricación'),
('005', 'FECHA DE VENCIMIENTO', 'Fecha de vencimiento'),
('006', 'COLOR', 'Color del producto'),
('007', 'TAMAÑO', 'Tamaño del producto'),
('008', 'COMPOSICIÓN', 'Composición del producto'),
('009', 'MATERIAL', 'Material del producto'),
('010', 'CANTIDAD DE PIEZAS', 'Cantidad de piezas')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAT-033: DOCUMENTO RELACIONADO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_033_documento_relacionado (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_033_documento_relacionado (codigo, nombre, descripcion) VALUES
('01', 'FACTURA', 'Factura relacionada'),
('02', 'COMPROBANTE DE CRÉDITO FISCAL', 'Comprobante de Crédito Fiscal relacionado'),
('03', 'NOTA DE REMISIÓN', 'Nota de Remisión relacionada'),
('04', 'NOTA DE CRÉDITO', 'Nota de Crédito relacionada'),
('05', 'NOTA DE DÉBITO', 'Nota de Débito relacionada'),
('06', 'DOCUMENTO DE IMPORTACIÓN', 'Documento de Importación'),
('07', 'CONTRATO', 'Contrato relacionado'),
('08', 'LICENCIA', 'Licencia relacionada'),
('09', 'PERMISO', 'Permiso relacionado'),
('10', 'OTRO DOCUMENTO', 'Otro documento relacionado')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PAÍSES (REFERENCIA ADICIONAL)
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_paises (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_paises (codigo, nombre) VALUES
('SV', 'EL SALVADOR'),
('US', 'ESTADOS UNIDOS'),
('GT', 'GUATEMALA'),
('HN', 'HONDURAS'),
('NI', 'NICARAGUA'),
('CR', 'COSTA RICA'),
('PA', 'PANAMÁ'),
('MX', 'MÉXICO'),
('ES', 'ESPAÑA'),
('AG', 'ARGENTINA'),
('BR', 'BRASIL'),
('CL', 'CHILE'),
('CO', 'COLOMBIA'),
('PE', 'PERÚ'),
('VE', 'VENEZUELA'),
('EC', 'ECUADOR'),
('BO', 'BOLIVIA'),
('PY', 'PARAGUAY'),
('UY', 'URUGUAY'),
('FR', 'FRANCIA'),
('DE', 'ALEMANIA'),
('IT', 'ITALIA'),
('GB', 'REINO UNIDO'),
('CA', 'CANADÁ'),
('AU', 'AUSTRALIA'),
('JP', 'JAPÓN'),
('CN', 'CHINA'),
('IN', 'INDIA'),
('RU', 'RUSIA'),
('ZA', 'SUDÁFRICA')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cat_001_codigo ON cat_001_ambiente(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_002_codigo ON cat_002_version_formato(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_003_codigo ON cat_003_tipo_documento(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_004_codigo ON cat_004_monedas(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_005_codigo ON cat_005_departamentos(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_006_codigo ON cat_006_municipios(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_006_departamento ON cat_006_municipios(departamento_codigo);
CREATE INDEX IF NOT EXISTS idx_cat_007_codigo ON cat_007_tipo_establecimiento(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_008_codigo ON cat_008_distritos(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_009_codigo ON cat_009_tipo_ingreso(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_010_codigo ON cat_010_tipo_retencion(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_011_codigo ON cat_011_tipo_doc_relacionado(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_012_codigo ON cat_012_tipo_transmision(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_013_codigo ON cat_013_tipo_dte(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_014_codigo ON cat_014_tipo_invalidacion(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_015_codigo ON cat_015_indicador_comprobante(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_016_codigo ON cat_016_tipo_venta(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_017_codigo ON cat_017_estado_derecho(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_018_codigo ON cat_018_indicador_comision(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_019_codigo ON cat_019_codigo_incidencia(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_020_codigo ON cat_020_condicion_operacion(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_021_codigo ON cat_021_descripcion_operacion(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_022_codigo ON cat_022_tipo_afiliacion(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_023_codigo ON cat_023_regimen_tributario(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_024_codigo ON cat_024_codigo_actividad(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_025_codigo ON cat_025_otros_datos_direccion(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_026_codigo ON cat_026_metodo_pago(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_027_codigo ON cat_027_forma_pago(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_028_codigo ON cat_028_plazo_credito(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_029_codigo ON cat_029_tipo_precio(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_030_codigo ON cat_030_generador_codigo(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_031_codigo ON cat_031_unidad_medida(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_032_codigo ON cat_032_especificacion_tecnica(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_033_codigo ON cat_033_documento_relacionado(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_paises_codigo ON cat_paises(codigo);

-- ============================================================
-- TABLA DE AUDITORÍA
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    tabla VARCHAR(100) NOT NULL,
    operacion VARCHAR(20) NOT NULL,
    usuario VARCHAR(100),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    descripcion TEXT,
    cantidad_registros INTEGER DEFAULT 0
);

-- ============================================================
-- CONFIRMACIÓN DE INICIALIZACIÓN
-- ============================================================
INSERT INTO audit_log (tabla, operacion, usuario, descripcion, cantidad_registros) 
VALUES ('SISTEMA', 'INICIALIZACIÓN', 'admin', 'Base de datos con 33 catálogos inicializada correctamente', 33);
