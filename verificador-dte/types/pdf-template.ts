export const MAX_JSON_FILES = 25;

export type TemplateId = 'clasica' | 'moderna' | 'minimalista';

export type LogoMode = 'profile' | 'upload' | 'none';

export type DteJson = {
  identificacion?: Record<string, unknown>;
  emisor?: Record<string, unknown>;
  receptor?: Record<string, unknown>;
  cuerpoDocumento?: Array<Record<string, unknown>>;
  resumen?: Record<string, unknown>;
  selloRecibido?: string;
  selloRecepcion?: string;
  respuestaHacienda?: Record<string, unknown>;
  responseHacienda?: Record<string, unknown>;
};

export type PdfResult = {
  sourceName: string;
  tipoDte: string;
  codigoGeneracion: string;
  estado: 'GENERADO' | 'ERROR';
  fileName: string;
  blob?: Blob;
  error?: string;
};

export type PdfTemplate = {
  id: TemplateId;
  name: string;
  description: string;
  accent: string;
  dark: string;
  soft: string;
};

export const pdfTemplates: PdfTemplate[] = [
  {
    id: 'clasica',
    name: 'Clásica',
    description: 'Formato sobrio para documentos fiscales y despacho contable.',
    accent: '#facc15',
    dark: '#111827',
    soft: '#f8fafc',
  },
  {
    id: 'moderna',
    name: 'Moderna',
    description: 'Encabezado visual, bloques limpios y énfasis en totales.',
    accent: '#22c55e',
    dark: '#0f172a',
    soft: '#ecfdf5',
  },
  {
    id: 'minimalista',
    name: 'Minimalista',
    description: 'Diseño claro, compacto y sin ruido para lectura rápida.',
    accent: '#38bdf8',
    dark: '#18181b',
    soft: '#f0f9ff',
  },
];

export const tipoDteLabels: Record<string, string> = {
  '01': 'Factura',
  '03': 'Comprobante de Crédito Fiscal',
  '04': 'Nota de Remisión',
  '05': 'Nota de Crédito',
  '06': 'Nota de Débito',
  '07': 'Comprobante de Retención',
  '11': 'Factura de Exportación',
  '14': 'Factura de Sujeto Excluido',
  '15': 'Comprobante de Donación',
};
