CREATE TABLE IF NOT EXISTS dte_control_sequences (
    id SERIAL PRIMARY KEY,
    emisor_id INTEGER NOT NULL REFERENCES emisores(id) ON DELETE CASCADE,
    nit VARCHAR(20) NOT NULL,
    tipo_dte VARCHAR(2) NOT NULL,
    establecimiento VARCHAR(4) NOT NULL DEFAULT '001',
    punto_emision VARCHAR(4) NOT NULL DEFAULT '001',
    current_value BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (emisor_id, tipo_dte, establecimiento, punto_emision)
);

CREATE INDEX IF NOT EXISTS idx_dte_control_sequences_emisor ON dte_control_sequences(emisor_id);
