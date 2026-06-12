import {
  extractEmisor,
  extractIdentificacion,
  extractReceptor,
  extractResumenMontos,
  extractSelloFromJson,
} from '@/lib/dte-json-fields';

type JsonRecord = Record<string, unknown>;

const UUID_RE =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

export const ALLOWED_TIPO_DTE = new Set(['01', '03', '05', '06', '09', '11', '14']);

export const TIPO_DTE_LABELS: Record<string, string> = {
  '01': 'Factura',
  '03': 'Comprobante de Crédito Fiscal',
  '05': 'Nota de Crédito',
  '06': 'Nota de Débito',
  '09': 'Documento Contable de Liquidación',
  '11': 'Factura de Exportación',
  '14': 'Factura de Sujeto Excluido',
};

export type RelatedDocumentRef = {
  codigoGeneracion: string;
  tipoDocumento: string;
  fechaEmi: string;
};

export type ParsedDteImport = {
  codigoGeneracion: string;
  fecEmi: string;
  tipoDte: string;
  tipoDteLabel: string;
  numeroControl: string;
  ambiente: string;
  selloRecepcion: string;
  emisorNit: string;
  emisorNrc: string;
  emisorNombre: string;
  receptorNit: string;
  receptorNrc: string;
  montoTotal: number;
  iva: number;
  relatedDocuments: RelatedDocumentRef[];
};

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function normalizeDate(raw: string): string {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dmy = value.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return '';
}

function collectCandidates(raw: unknown): JsonRecord[] {
  if (!raw || typeof raw !== 'object') return [];
  if (Array.isArray(raw)) {
    return raw.filter((item) => item && typeof item === 'object') as JsonRecord[];
  }
  return [raw as JsonRecord];
}

export function resolveDteItem(item: JsonRecord): JsonRecord {
  const wrappers = [
    item,
    asRecord(item.dte),
    asRecord(item.documento),
    asRecord(item.data),
  ];
  for (const candidate of wrappers) {
    if (Object.keys(asRecord(candidate.identificacion)).length > 0) {
      return candidate;
    }
  }
  return item;
}

function extractRelatedFromArray(arr: unknown): RelatedDocumentRef[] {
  if (!Array.isArray(arr)) return [];
  const out: RelatedDocumentRef[] = [];
  for (const entry of arr) {
    const row = asRecord(entry);
    const codigoGeneracion = asString(
      row.numeroDocumento ?? row.codigoGeneracion ?? row.codGen
    ).toUpperCase();
    if (!UUID_RE.test(codigoGeneracion)) continue;
    out.push({
      codigoGeneracion,
      tipoDocumento: asString(row.tipoDocumento ?? row.tipoDte),
      fechaEmi: normalizeDate(
        asString(row.fechaEmision ?? row.fecEmi ?? row.fechaGeneracion)
      ),
    });
  }
  return out;
}

export function extractRelatedDocuments(dte: JsonRecord): RelatedDocumentRef[] {
  const keys = [
    'documentoRelacionado',
    'documentosRelacionados',
    'documentoRelacionados',
  ];
  const seen = new Set<string>();
  const out: RelatedDocumentRef[] = [];

  for (const key of keys) {
    for (const ref of extractRelatedFromArray(dte[key])) {
      if (seen.has(ref.codigoGeneracion)) continue;
      seen.add(ref.codigoGeneracion);
      out.push(ref);
    }
  }
  return out;
}

export function isAllowedTipoDte(tipoDte: string): boolean {
  return ALLOWED_TIPO_DTE.has(tipoDte.padStart(2, '0'));
}

export function parseDteFromObject(raw: unknown): ParsedDteImport | null {
  for (const item of collectCandidates(raw)) {
    const dte = resolveDteItem(item);
    const ident = extractIdentificacion(dte);
    const codigoGeneracion = ident.generacion.toUpperCase();
    const fecEmi = normalizeDate(ident.fechaISO);
    const tipoDte = ident.tipoDte.padStart(2, '0');

    if (!UUID_RE.test(codigoGeneracion) || !fecEmi || !tipoDte) continue;

    const emisor = extractEmisor(dte);
    const receptor = extractReceptor(dte);
    const montos = extractResumenMontos(dte);
    const identRecord = asRecord(dte.identificacion);

    return {
      codigoGeneracion,
      fecEmi,
      tipoDte,
      tipoDteLabel: TIPO_DTE_LABELS[tipoDte] || `DTE ${tipoDte}`,
      numeroControl: ident.numeroControl,
      ambiente: asString(identRecord.ambiente) || '01',
      selloRecepcion: extractSelloFromJson(dte),
      emisorNit: emisor.nit,
      emisorNrc: emisor.nrc,
      emisorNombre: emisor.nombre,
      receptorNit: receptor.nit,
      receptorNrc: receptor.nrc,
      montoTotal: montos.totalPagar || montos.montoTotalOperacion,
      iva: montos.iva,
      relatedDocuments: extractRelatedDocuments(dte),
    };
  }
  return null;
}

export function parseDteForImport(buffer: Buffer): ParsedDteImport | null {
  const text = buffer.toString('utf8');
  try {
    return parseDteFromObject(JSON.parse(text));
  } catch {
    const codMatch = text.match(
      /"codigoGeneracion"\s*:\s*"([0-9A-Fa-f-]{36})"/i
    );
    const fechaMatch = text.match(
      /"(?:fecEmi|fechaEmi|fechaEmision)"\s*:\s*"(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})"/i
    );
    const tipoMatch = text.match(/"tipoDte"\s*:\s*"(\d{2})"/i);
    if (codMatch && fechaMatch) {
      const codigoGeneracion = codMatch[1].toUpperCase();
      const fecEmi = normalizeDate(fechaMatch[1]);
      const tipoDte = (tipoMatch?.[1] || '').padStart(2, '0');
      if (UUID_RE.test(codigoGeneracion) && fecEmi && tipoDte) {
        return {
          codigoGeneracion,
          fecEmi,
          tipoDte,
          tipoDteLabel: TIPO_DTE_LABELS[tipoDte] || `DTE ${tipoDte}`,
          numeroControl: '',
          ambiente: '01',
          selloRecepcion: '',
          emisorNit: '',
          emisorNrc: '',
          emisorNombre: '',
          receptorNit: '',
          receptorNrc: '',
          montoTotal: 0,
          iva: 0,
          relatedDocuments: [],
        };
      }
    }
    return null;
  }
}

/** Compat: parser minimo usado antes del catalogo enriquecido. */
export function parseDteJsonFields(buffer: Buffer): { codGen: string; fechaYMD: string } | null {
  const parsed = parseDteForImport(buffer);
  if (!parsed) return null;
  return { codGen: parsed.codigoGeneracion, fechaYMD: parsed.fecEmi };
}

export function isDateInRange(
  fechaYMD: string,
  dateFrom: string,
  dateTo: string
): boolean {
  return fechaYMD >= dateFrom && fechaYMD <= dateTo;
}

export function isJsonAttachment(fileName: string, mimeType?: string | null) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return true;
  const mime = String(mimeType || '').toLowerCase();
  return mime.includes('json');
}
