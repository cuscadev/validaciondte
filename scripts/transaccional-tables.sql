-- ============================================================
-- TABLAS TRANSACCIONALES - CLIENTES Y EMISORES
-- Datos de Facturación Electrónica
-- ============================================================

-- ============================================================
-- TABLA: USUARIOS (Referencia Firebase)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    nombre VARCHAR(100),
    rol VARCHAR(50) NOT NULL DEFAULT 'cliente', -- 'superadmin', 'admin', 'cliente'
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_firebase_uid ON usuarios(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);

-- ============================================================
-- TABLA: EMISORES (Empresas que Emiten DTE)
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
    
    -- Dirección
    departamento_codigo VARCHAR(2), -- FK a cat_012_departamento
    municipio_codigo VARCHAR(2),    -- FK a cat_013_municipio (con departamento_codigo)
    distrito_codigo VARCHAR(2),     -- FK a cat_008_distrito (con dept + municipio)
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
    ambiente_codigo VARCHAR(2) DEFAULT '00', -- CAT-001 (producción/pruebas)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (tipo_establecimiento_codigo) REFERENCES cat_007_tipo_establecimiento(codigo),
    FOREIGN KEY (codigo_actividad) REFERENCES cat_024_codigo_actividad(codigo),
    FOREIGN KEY (departamento_codigo) REFERENCES cat_012_departamento(codigo),
    FOREIGN KEY (municipio_codigo) REFERENCES cat_013_municipio(codigo),
    FOREIGN KEY (regimen_tributario_codigo) REFERENCES cat_023_regimen_tributario(codigo),
    FOREIGN KEY (tipo_afiliacion_codigo) REFERENCES cat_022_tipo_afiliacion(codigo),
    FOREIGN KEY (ambiente_codigo) REFERENCES cat_001_ambiente(codigo)
);

CREATE INDEX IF NOT EXISTS idx_emisores_nit ON emisores(nit);
CREATE INDEX IF NOT EXISTS idx_emisores_nrc ON emisores(nrc);
CREATE INDEX IF NOT EXISTS idx_emisores_usuario_id ON emisores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_emisores_activo ON emisores(activo);

-- ============================================================
-- TABLA: CLIENTES (Receptores de DTE)
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    
    -- Identificación
    tipo_documento_codigo VARCHAR(2) NOT NULL, -- FK a CAT-003 (NIT, DUI, Pasaporte, etc.)
    numero_documento VARCHAR(20) NOT NULL,
    
    -- Datos Personales/Empresa
    nombre VARCHAR(255) NOT NULL,
    nombre_comercial VARCHAR(255),
    razon_social VARCHAR(255),
    
    -- Contacto
    telefono VARCHAR(20),
    correo VARCHAR(255),
    
    -- Dirección
    departamento_codigo VARCHAR(2), -- FK a cat_012_departamento
    municipio_codigo VARCHAR(2),    -- FK a cat_013_municipio (con departamento_codigo)
    distrito_codigo VARCHAR(2),     -- FK a cat_008_distrito (con dept + municipio)
    complemento_direccion VARCHAR(200),
    
    -- Datos Tributarios (opcional para clientes)
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
    emisor_id INTEGER, -- FK a emisores (emisor que lo añadió)
    
    -- Usuario Propietario (si es un usuario autenticado)
    usuario_id INTEGER, -- FK a usuarios (si el cliente es usuario)
    
    -- Preferencias
    uso_preferente VARCHAR(50), -- 'facturacion', 'reportes', etc.
    
    -- Estado
    activo BOOLEAN DEFAULT TRUE,
    datos_completados BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tipo_documento_codigo) REFERENCES cat_003_tipo_documento(codigo),
    FOREIGN KEY (departamento_codigo) REFERENCES cat_012_departamento(codigo),
    FOREIGN KEY (municipio_codigo) REFERENCES cat_013_municipio(codigo),
    FOREIGN KEY (codigo_actividad) REFERENCES cat_024_codigo_actividad(codigo),
    FOREIGN KEY (regimen_tributario_codigo) REFERENCES cat_023_regimen_tributario(codigo),
    FOREIGN KEY (pais_codigo) REFERENCES cat_paises(codigo),
    FOREIGN KEY (emisor_id) REFERENCES emisores(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    
    UNIQUE(numero_documento, emisor_id) -- No duplicar clientes por emisor
);

CREATE INDEX IF NOT EXISTS idx_clientes_numero_documento ON clientes(numero_documento);
CREATE INDEX IF NOT EXISTS idx_clientes_emisor_id ON clientes(emisor_id);
CREATE INDEX IF NOT EXISTS idx_clientes_usuario_id ON clientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);
CREATE INDEX IF NOT EXISTS idx_clientes_correo ON clientes(correo);

-- ============================================================
-- TABLA: RELACIÓN USUARIO-EMISOR (Para múltiples roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuario_emisor (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    emisor_id INTEGER NOT NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'editor', -- 'propietario', 'editor', 'visualizador'
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (emisor_id) REFERENCES emisores(id) ON DELETE CASCADE,
    
    UNIQUE(usuario_id, emisor_id) -- Evitar duplicados
);

CREATE INDEX IF NOT EXISTS idx_usuario_emisor_usuario_id ON usuario_emisor(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_emisor_emisor_id ON usuario_emisor(emisor_id);
CREATE INDEX IF NOT EXISTS idx_usuario_emisor_rol ON usuario_emisor(rol);

-- ============================================================
-- TABLA: CONFIGURACIÓN DE FACTURACIÓN POR EMISOR
-- ============================================================
CREATE TABLE IF NOT EXISTS emisor_configuracion (
    id SERIAL PRIMARY KEY,
    emisor_id INTEGER NOT NULL UNIQUE,
    
    -- Método de Pago por defecto (CAT-026)
    metodo_pago_defecto VARCHAR(2),
    
    -- Forma de Pago por defecto (CAT-027)
    forma_pago_defecto VARCHAR(2),
    
    -- Plazo de Crédito por defecto (CAT-028)
    plazo_credito_defecto VARCHAR(3),
    
    -- Tipo de Venta por defecto (CAT-016)
    tipo_venta_defecto VARCHAR(2),
    
    -- Moneda por defecto (CAT-004)
    moneda_defecto VARCHAR(3) DEFAULT 'USD',
    
    -- Tasa de IVA
    tasa_iva DECIMAL(5, 2) DEFAULT 13.00,
    
    -- Generador de Código (CAT-030)
    generador_codigo VARCHAR(2) DEFAULT '01', -- Aleatorio por defecto
    
    -- Formato de Correlativo
    prefijo_correlativo VARCHAR(10),
    
    -- Retención por defecto (CAT-010)
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
    FOREIGN KEY (generador_codigo) REFERENCES cat_030_generador_codigo(codigo),
    FOREIGN KEY (tipo_retencion_defecto) REFERENCES cat_010_tipo_retencion(codigo)
);

CREATE INDEX IF NOT EXISTS idx_emisor_configuracion_emisor_id ON emisor_configuracion(emisor_id);

-- ============================================================
-- TABLA: AUDITORÍA DE CAMBIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria_cambios (
    id SERIAL PRIMARY KEY,
    tabla_nombre VARCHAR(100) NOT NULL,
    registro_id INTEGER NOT NULL,
    usuario_id INTEGER,
    accion VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_registro ON auditoria_cambios(tabla_nombre, registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria_cambios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria_cambios(fecha_cambio);

-- ============================================================
-- TABLA: LOG DE TRANSACCIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS log_transacciones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    emisor_id INTEGER,
    tipo_operacion VARCHAR(50), -- 'creacion_dte', 'envio_hacienda', 'descarga', etc.
    descripcion TEXT,
    status VARCHAR(50), -- 'exitoso', 'error', 'pendiente'
    mensaje_error TEXT,
    datos_log JSONB,
    fecha_transaccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (emisor_id) REFERENCES emisores(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_log_transacciones_usuario ON log_transacciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_log_transacciones_emisor ON log_transacciones(emisor_id);
CREATE INDEX IF NOT EXISTS idx_log_transacciones_fecha ON log_transacciones(fecha_transaccion);
CREATE INDEX IF NOT EXISTS idx_log_transacciones_status ON log_transacciones(status);

-- ============================================================
-- INSERCIÓN DE DATOS DE EJEMPLO
-- ============================================================

-- Usuario Admin de Prueba
INSERT INTO usuarios (firebase_uid, email, nombre, rol) 
VALUES ('admin-firebase-uid-001', 'admin@facturacion.sv', 'Administrador Sistema', 'superadmin')
ON CONFLICT DO NOTHING;

-- Usuario Cliente de Prueba
INSERT INTO usuarios (firebase_uid, email, nombre, rol) 
VALUES ('user-firebase-uid-001', 'usuario@empresa.sv', 'Usuario Empresa', 'cliente')
ON CONFLICT DO NOTHING;

-- Log de Inicialización
INSERT INTO audit_log (tabla, operacion, usuario, descripcion, cantidad_registros) 
VALUES ('TABLAS_TRANSACCIONALES', 'INICIALIZACIÓN', 'admin', 'Tablas de usuarios, emisores, clientes inicializadas', 5)
ON CONFLICT DO NOTHING;
