-- Corregir CAT-013 según Ministerio de Hacienda (codigos oficiales tipoDte)
DELETE FROM cat_013_tipo_dte;

INSERT INTO cat_013_tipo_dte (codigo, nombre, descripcion) VALUES
('01', 'FACTURA CONSUMIDOR FINAL', 'Factura Electronica Consumidor Final'),
('03', 'COMPROBANTE DE CREDITO FISCAL', 'Comprobante de Credito Fiscal Electronico'),
('04', 'NOTA DE REMISION', 'Nota de Remision Electronica'),
('05', 'NOTA DE CREDITO', 'Nota de Credito Electronica'),
('06', 'NOTA DE DEBITO', 'Nota de Debito Electronica'),
('07', 'COMPROBANTE DE RETENCION', 'Comprobante de Retencion Electronico'),
('08', 'COMPROBANTE DE LIQUIDACION', 'Comprobante de Liquidacion Electronico'),
('09', 'DOCUMENTO CONTABLE DE LIQUIDACION', 'Documento Contable de Liquidacion Electronico'),
('11', 'FACTURA DE EXPORTACION', 'Factura de Exportacion Electronica'),
('14', 'FACTURA SUJETO EXCLUIDO', 'Factura de Sujeto Excluido Electronica'),
('15', 'COMPROBANTE DE DONACION', 'Comprobante de Donacion Electronico')
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  activo = TRUE;
