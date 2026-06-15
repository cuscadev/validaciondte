-- ============================================================
-- CORRECCIÓN: TABLAS EMISORES Y CLIENTES
-- Actualizar estructura de municipios y distritos a 2 dígitos
-- ============================================================

-- ============================================================
-- ELIMINAR TABLAS DEPENDIENTES (en orden)
-- ============================================================
DROP TABLE IF EXISTS emisor_configuracion CASCADE;
DROP TABLE IF EXISTS usuario_emisor CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS emisores CASCADE;

-- ============================================================
-- TABLA: EMISORES (Versión Corregida)
-- ============================================================
CREATE TABLE IF NOT EXISTS emisores (
    id SERIAL PRIMARY KEY,
    nit VARCHAR(20) UNIQUE NOT NULL,
    nrc VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    nombre_comercial VARCHAR(255),
    razon_social VARCHAR(255),
    
    -- Tipo de Establecimiento (FK a CAT-007)
    tipo_establecimiento_codigo VARCHAR(2),
    
    -- Código de Actividad Económica (FK a CAT-024)
    codigo_actividad VARCHAR(10),
    descripcion_actividad TEXT,
    
    -- Dirección (2 dígitos c/u)
    departamento_codigo VARCHAR(2), -- FK a cat_012_departamento
    municipio_codigo VARCHAR(2),    -- FK a CAT-006 (ahora 2 dígitos)
    distrito_codigo VARCHAR(2),     -- FK a CAT-008 (ahora 2 dígitos)
    complemento_direccion VARCHAR(200),
    
    -- Contacto
    telefono VARCHAR(20),
    correo VARCHAR(255),
    
    -- Datos de Régimen
    regimen_tributario_codigo VARCHAR(2), -- FK a CAT-023
    tipo_afiliacion_codigo VARCHAR(2),    -- FK a CAT-022
    
    -- Certificado Digital
    certificado_path VARCHAR(500),
    certificado_password_hash VARCHAR(500),
    fecha_vencimiento_cert DATE,
    
    -- Usuario Propietario (FK a usuarios)
    usuario_id INTEGER,
    
    -- Estado
    activo BOOLEAN DEFAULT TRUE,
    ambiente_codigo VARCHAR(2) DEFAULT '00', -- CAT-001
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (tipo_establecimiento_codigo) REFERENCES cat_007_tipo_establecimiento(codigo),
    FOREIGN KEY (codigo_actividad) REFERENCES cat_024_codigo_actividad(codigo),
    FOREIGN KEY (departamento_codigo) REFERENCES cat_012_departamento(codigo),
    FOREIGN KEY (regimen_tributario_codigo) REFERENCES cat_023_regimen_tributario(codigo),
    FOREIGN KEY (tipo_afiliacion_codigo) REFERENCES cat_022_tipo_afiliacion(codigo),
    FOREIGN KEY (ambiente_codigo) REFERENCES cat_001_ambiente(codigo)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_emisores_nit ON emisores(nit);
CREATE INDEX IF NOT EXISTS idx_emisores_nrc ON emisores(nrc);
CREATE INDEX IF NOT EXISTS idx_emisores_usuario_id ON emisores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_emisores_activo ON emisores(activo);
CREATE INDEX IF NOT EXISTS idx_emisores_departamento ON emisores(departamento_codigo);

-- ============================================================
-- TABLA: CLIENTES (Versión Corregida)
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    
    -- Identificación
    tipo_documento_codigo VARCHAR(2) NOT NULL, -- FK a CAT-003
    numero_documento VARCHAR(20) NOT NULL,
    
    -- Datos Personales/Empresa
    nombre VARCHAR(255) NOT NULL,
    nombre_comercial VARCHAR(255),
    razon_social VARCHAR(255),
    
    -- Contacto
    telefono VARCHAR(20),
    correo VARCHAR(255),
    
    -- Dirección (2 dígitos c/u)
    departamento_codigo VARCHAR(2), -- FK a cat_012_departamento
    municipio_codigo VARCHAR(2),    -- FK a CAT-006 (ahora 2 dígitos)
    distrito_codigo VARCHAR(2),     -- FK a CAT-008 (ahora 2 dígitos) - NULLABLE
    complemento_direccion VARCHAR(200),
    
    -- Datos Tributarios (opcional)
    nrc VARCHAR(20),
    codigo_actividad VARCHAR(10), -- FK a CAT-024
    regimen_tributario_codigo VARCHAR(2), -- FK a CAT-023
    
    -- Clasificación
    tipo_cliente VARCHAR(50), -- 'persona_natural', 'persona_juridica', 'extranjero'
    es_consumidor_final BOOLEAN DEFAULT FALSE,
    
    -- País (para extranjeros)
    pais_codigo VARCHAR(2), -- FK a cat_paises
    cod_domiciliado INTEGER DEFAULT 0,
    
    -- Relación con Emisor
    emisor_id INTEGER, -- FK a emisores
    
    -- Usuario Propietario (si es un usuario autenticado)
    usuario_id INTEGER, -- FK a usuarios
    
    -- Preferencias
    uso_preferente VARCHAR(50),
    
    -- Estado
    activo BOOLEAN DEFAULT TRUE,
    datos_completados BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tipo_documento_codigo) REFERENCES cat_003_tipo_documento(codigo),
    FOREIGN KEY (departamento_codigo) REFERENCES cat_012_departamento(codigo),
    FOREIGN KEY (codigo_actividad) REFERENCES cat_024_codigo_actividad(codigo),
    FOREIGN KEY (regimen_tributario_codigo) REFERENCES cat_023_regimen_tributario(codigo),
    FOREIGN KEY (pais_codigo) REFERENCES cat_paises(codigo),
    FOREIGN KEY (emisor_id) REFERENCES emisores(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    
    UNIQUE(numero_documento, emisor_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_clientes_numero_documento ON clientes(numero_documento);
CREATE INDEX IF NOT EXISTS idx_clientes_emisor_id ON clientes(emisor_id);
CREATE INDEX IF NOT EXISTS idx_clientes_usuario_id ON clientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);
CREATE INDEX IF NOT EXISTS idx_clientes_correo ON clientes(correo);
CREATE INDEX IF NOT EXISTS idx_clientes_departamento ON clientes(departamento_codigo);

-- ============================================================
-- TABLA: RELACIÓN USUARIO-EMISOR
-- ============================================================
CREATE TABLE IF NOT EXISTS usuario_emisor (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    emisor_id INTEGER NOT NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'editor',
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (emisor_id) REFERENCES emisores(id) ON DELETE CASCADE,
    
    UNIQUE(usuario_id, emisor_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_emisor_usuario_id ON usuario_emisor(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_emisor_emisor_id ON usuario_emisor(emisor_id);

-- ============================================================
-- TABLA: CONFIGURACIÓN DE FACTURACIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS emisor_configuracion (
    id SERIAL PRIMARY KEY,
    emisor_id INTEGER NOT NULL UNIQUE,
    
    metodo_pago_defecto VARCHAR(2),
    forma_pago_defecto VARCHAR(2),
    plazo_credito_defecto VARCHAR(3),
    tipo_venta_defecto VARCHAR(2),
    moneda_defecto VARCHAR(3) DEFAULT 'USD',
    tasa_iva DECIMAL(5, 2) DEFAULT 13.00,
    generador_codigo VARCHAR(2) DEFAULT '01',
    prefijo_correlativo VARCHAR(10),
    tipo_retencion_defecto VARCHAR(2),
    
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (emisor_id) REFERENCES emisores(id) ON DELETE CASCADE,
    FOREIGN KEY (metodo_pago_defecto) REFERENCES cat_026_metodo_pago(codigo),
    FOREIGN KEY (forma_pago_defecto) REFERENCES cat_027_forma_pago(codigo),
    FOREIGN KEY (plazo_credito_defecto) REFERENCES cat_028_plazo_credito(codigo),
    FOREIGN KEY (tipo_venta_defecto) REFERENCES cat_016_tipo_venta(codigo),
    FOREIGN KEY (moneda_defecto) REFERENCES cat_004_monedas(codigo),
    FOREIGN KEY (tipo_retencion_defecto) REFERENCES cat_010_tipo_retencion(codigo)
);

CREATE INDEX IF NOT EXISTS idx_emisor_configuracion_emisor_id ON emisor_configuracion(emisor_id);

-- ============================================================
-- INSERTAR DATOS DE EJEMPLO
-- ============================================================

-- Emisor de Prueba (F & G CONSTRUCTORA)
INSERT INTO emisores (nit, nrc, nombre, nombre_comercial, tipo_establecimiento_codigo, 
                     codigo_actividad, departamento_codigo, municipio_codigo, distrito_codigo,
                     complemento_direccion, telefono, correo, regimen_tributario_codigo,
                     tipo_afiliacion_codigo, usuario_id, activo)
SELECT 
    '06141812151015',
    '2463887',
    'F & G CONSTRUCTORA DE EL SALVADOR, S.A. DE C.V.',
    'F & G CONSTRUCTORA DE EL SALVADOR, S.A. DE C.V.',
    '01',
    '42900',
    '05',
    '28', -- Santa Tecla (La Libertad)
    '28', -- Distrito 28
    'BOULEVARD DIAGNOSTICO Y LABORATORIO, LOCAL 3, SANTA TECLA, LA LIBERTAD',
    '22439538',
    'fygconstructorasadecv@gmail.com',
    '01',
    '01',
    (SELECT id FROM usuarios WHERE email = 'admin@facturacion.sv' LIMIT 1),
    TRUE
WHERE NOT EXISTS (SELECT 1 FROM emisores WHERE nit = '06141812151015')
ON CONFLICT DO NOTHING;

-- Cliente de Prueba (CONVASES)
INSERT INTO clientes (tipo_documento_codigo, numero_documento, nombre, tipo_cliente,
                     departamento_codigo, municipio_codigo, distrito_codigo,
                     complemento_direccion, telefono, correo, nrc,
                     codigo_actividad, regimen_tributario_codigo, es_consumidor_final,
                     pais_codigo, cod_domiciliado, emisor_id, usuario_id, activo)
SELECT
    '36',
    '12170903051017',
    'CONVASES, S.A. DE C.V.',
    'persona_juridica',
    '05',
    '28', -- Santa Tecla (La Libertad)
    NULL, -- Sin distrito para clientes
    'CARRETERA AL CUCO KM 142.5, RESTAURANTE LA PEMA, SAN MIGUEL',
    '75896520',
    'cvslplgdigital@gmail.com',
    '1639213',
    '42900',
    '01',
    FALSE,
    'SV',
    1,
    (SELECT id FROM emisores WHERE nit = '06141812151015' LIMIT 1),
    (SELECT id FROM usuarios WHERE email = 'usuario@empresa.sv' LIMIT 1),
    TRUE
WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE numero_documento = '12170903051017')
ON CONFLICT DO NOTHING;

-- Configuración del Emisor
INSERT INTO emisor_configuracion (emisor_id, metodo_pago_defecto, forma_pago_defecto,
                                 plazo_credito_defecto, tipo_venta_defecto, moneda_defecto,
                                 tasa_iva, generador_codigo, tipo_retencion_defecto)
SELECT
    id,
    '01', -- Efectivo
    '06', -- Inmediato
    '001', -- Inmediato
    '01', -- Contado
    'USD',
    13.00,
    '01', -- Aleatorio
    '01'
FROM emisores
WHERE nit = '06141812151015'
  AND NOT EXISTS (SELECT 1 FROM emisor_configuracion WHERE emisor_id = emisores.id)
ON CONFLICT DO NOTHING;

-- ============================================================
-- AUDITORÍA
-- ============================================================
INSERT INTO audit_log (tabla, operacion, usuario, descripcion, cantidad_registros) 
VALUES ('TABLAS_FACTURACION', 'CORRECCIÓN', 'admin', 'Actualización a estructura 2 dígitos (municipio/distrito)', 4)
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================
SELECT COUNT(*) as total_emisores FROM emisores;
SELECT COUNT(*) as total_clientes FROM clientes;
SELECT COUNT(*) as total_config FROM emisor_configuracion;
