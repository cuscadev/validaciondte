-- ============================================================
-- EMISIONES DTE — una tabla por tipo de documento (payload JSONB)
-- Ejecutar en Supabase: go run ./cmd/apply-schema ../scripts/dte-emisiones-schema.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enrutador: resolver id -> tipo sin escanear todas las tablas
CREATE TABLE IF NOT EXISTS dte_emisiones_routing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_dte VARCHAR(2) NOT NULL CHECK (tipo_dte IN ('01', '03', '05', '06', '11', '14')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dte_emisiones_routing_tipo ON dte_emisiones_routing(tipo_dte);

-- Plantilla común (documentada; cada tabla la replica)
-- id UUID PK (mismo que routing.id)
-- firebase_uid, emisor_id, receptor_id
-- codigo_generacion, numero_control, status, environment, source
-- total_pagar, sello_recepcion, error_message
-- payload JSONB — documento completo (equivalente a Firestore facturacionEmisiones)
-- created_at, updated_at

CREATE TABLE IF NOT EXISTS dte_emisiones_01_consumidor_final (
    id UUID PRIMARY KEY REFERENCES dte_emisiones_routing(id) ON DELETE CASCADE,
    firebase_uid VARCHAR(255) NOT NULL,
    emisor_id INTEGER REFERENCES emisores(id) ON DELETE SET NULL,
    receptor_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    codigo_generacion VARCHAR(36),
    numero_control VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'started',
    environment VARCHAR(20) NOT NULL DEFAULT 'test',
    source VARCHAR(100),
    total_pagar NUMERIC(14, 2),
    sello_recepcion TEXT,
    error_message TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dte_em_01_codigo ON dte_emisiones_01_consumidor_final(codigo_generacion) WHERE codigo_generacion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dte_em_01_uid ON dte_emisiones_01_consumidor_final(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_dte_em_01_status ON dte_emisiones_01_consumidor_final(status);

CREATE TABLE IF NOT EXISTS dte_emisiones_03_credito_fiscal (
    id UUID PRIMARY KEY REFERENCES dte_emisiones_routing(id) ON DELETE CASCADE,
    firebase_uid VARCHAR(255) NOT NULL,
    emisor_id INTEGER REFERENCES emisores(id) ON DELETE SET NULL,
    receptor_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    codigo_generacion VARCHAR(36),
    numero_control VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'started',
    environment VARCHAR(20) NOT NULL DEFAULT 'test',
    source VARCHAR(100),
    total_pagar NUMERIC(14, 2),
    sello_recepcion TEXT,
    error_message TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dte_em_03_codigo ON dte_emisiones_03_credito_fiscal(codigo_generacion) WHERE codigo_generacion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dte_em_03_uid ON dte_emisiones_03_credito_fiscal(firebase_uid);

CREATE TABLE IF NOT EXISTS dte_emisiones_05_nota_credito (
    id UUID PRIMARY KEY REFERENCES dte_emisiones_routing(id) ON DELETE CASCADE,
    firebase_uid VARCHAR(255) NOT NULL,
    emisor_id INTEGER REFERENCES emisores(id) ON DELETE SET NULL,
    receptor_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    codigo_generacion VARCHAR(36),
    numero_control VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'started',
    environment VARCHAR(20) NOT NULL DEFAULT 'test',
    source VARCHAR(100),
    total_pagar NUMERIC(14, 2),
    sello_recepcion TEXT,
    related_emision_id UUID,
    error_message TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dte_em_05_codigo ON dte_emisiones_05_nota_credito(codigo_generacion) WHERE codigo_generacion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dte_em_05_uid ON dte_emisiones_05_nota_credito(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_dte_em_05_related ON dte_emisiones_05_nota_credito(related_emision_id);

CREATE TABLE IF NOT EXISTS dte_emisiones_06_nota_debito (
    id UUID PRIMARY KEY REFERENCES dte_emisiones_routing(id) ON DELETE CASCADE,
    firebase_uid VARCHAR(255) NOT NULL,
    emisor_id INTEGER REFERENCES emisores(id) ON DELETE SET NULL,
    receptor_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    codigo_generacion VARCHAR(36),
    numero_control VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'started',
    environment VARCHAR(20) NOT NULL DEFAULT 'test',
    source VARCHAR(100),
    total_pagar NUMERIC(14, 2),
    sello_recepcion TEXT,
    related_emision_id UUID,
    error_message TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dte_em_06_codigo ON dte_emisiones_06_nota_debito(codigo_generacion) WHERE codigo_generacion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dte_em_06_uid ON dte_emisiones_06_nota_debito(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_dte_em_06_related ON dte_emisiones_06_nota_debito(related_emision_id);

CREATE TABLE IF NOT EXISTS dte_emisiones_11_exportacion (
    id UUID PRIMARY KEY REFERENCES dte_emisiones_routing(id) ON DELETE CASCADE,
    firebase_uid VARCHAR(255) NOT NULL,
    emisor_id INTEGER REFERENCES emisores(id) ON DELETE SET NULL,
    receptor_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    codigo_generacion VARCHAR(36),
    numero_control VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'started',
    environment VARCHAR(20) NOT NULL DEFAULT 'test',
    source VARCHAR(100),
    total_pagar NUMERIC(14, 2),
    sello_recepcion TEXT,
    error_message TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dte_em_11_codigo ON dte_emisiones_11_exportacion(codigo_generacion) WHERE codigo_generacion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dte_em_11_uid ON dte_emisiones_11_exportacion(firebase_uid);

CREATE TABLE IF NOT EXISTS dte_emisiones_14_sujeto_excluido (
    id UUID PRIMARY KEY REFERENCES dte_emisiones_routing(id) ON DELETE CASCADE,
    firebase_uid VARCHAR(255) NOT NULL,
    emisor_id INTEGER REFERENCES emisores(id) ON DELETE SET NULL,
    receptor_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    codigo_generacion VARCHAR(36),
    numero_control VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'started',
    environment VARCHAR(20) NOT NULL DEFAULT 'test',
    source VARCHAR(100),
    total_pagar NUMERIC(14, 2),
    sello_recepcion TEXT,
    error_message TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dte_em_14_codigo ON dte_emisiones_14_sujeto_excluido(codigo_generacion) WHERE codigo_generacion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dte_em_14_uid ON dte_emisiones_14_sujeto_excluido(firebase_uid);

-- Vista unificada para listados y reportes
CREATE OR REPLACE VIEW v_dte_emisiones AS
SELECT id, '01'::varchar(2) AS tipo_dte, firebase_uid, emisor_id, receptor_id,
       codigo_generacion, numero_control, status, environment, source,
       total_pagar, sello_recepcion, NULL::uuid AS related_emision_id,
       error_message, payload, created_at, updated_at
FROM dte_emisiones_01_consumidor_final
UNION ALL
SELECT id, '03', firebase_uid, emisor_id, receptor_id,
       codigo_generacion, numero_control, status, environment, source,
       total_pagar, sello_recepcion, NULL,
       error_message, payload, created_at, updated_at
FROM dte_emisiones_03_credito_fiscal
UNION ALL
SELECT id, '05', firebase_uid, emisor_id, receptor_id,
       codigo_generacion, numero_control, status, environment, source,
       total_pagar, sello_recepcion, related_emision_id,
       error_message, payload, created_at, updated_at
FROM dte_emisiones_05_nota_credito
UNION ALL
SELECT id, '06', firebase_uid, emisor_id, receptor_id,
       codigo_generacion, numero_control, status, environment, source,
       total_pagar, sello_recepcion, related_emision_id,
       error_message, payload, created_at, updated_at
FROM dte_emisiones_06_nota_debito
UNION ALL
SELECT id, '11', firebase_uid, emisor_id, receptor_id,
       codigo_generacion, numero_control, status, environment, source,
       total_pagar, sello_recepcion, NULL,
       error_message, payload, created_at, updated_at
FROM dte_emisiones_11_exportacion
UNION ALL
SELECT id, '14', firebase_uid, emisor_id, receptor_id,
       codigo_generacion, numero_control, status, environment, source,
       total_pagar, sello_recepcion, NULL,
       error_message, payload, created_at, updated_at
FROM dte_emisiones_14_sujeto_excluido;
