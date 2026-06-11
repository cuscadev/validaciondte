import { isProbableCodGen, tryParseFechaFlexible } from '@/lib/dteCommon';
import { buildHaciendaPublicUrl } from '@/lib/gmail/hacienda-url';

const COD_GEN_ALIASES = [
  'codGen',
  'codigoGeneracion',
  'codigo',
  'codigoGeneracionDte',
  'codigo_generacion',
  'FeCodigoGeneracion',
];

const FECHA_ALIASES = [
  'fechaEmi',
  'fecEmi',
  'fecha',
  'fechaEmision',
  'fecha_emision',
  'FeFechaGeneracionDte',
  'fechaGeneracionDte',
];

const AMBIENTE_ALIASES = ['ambiente', 'AMB', 'env', 'environment'];

export function extractUrlFromText(raw: string): string {
  const cleanValue = raw.trim().replace(/&amp;/g, '&').replace(/[\s,;]+$/g, '');
  if (cleanValue.startsWith('http://') || cleanValue.startsWith('https://')) {
    return cleanValue;
  }

  const match = cleanValue.match(/https?:\/\/[^\s"']+/i);
  return match?.[0]?.replace(/[\s,;]+$/g, '') || '';
}

export function pickQueryParam(url: URL, aliases: string[]): string {
  for (const name of aliases) {
    const direct = url.searchParams.get(name);
    if (direct) return direct;
  }

  const entries = Array.from(url.searchParams.entries());
  for (const name of aliases) {
    const found = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (found?.[1]) return found[1];
  }

  return '';
}

function formatDateYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDmy(date: Date): string {
  const ymd = formatDateYmd(date);
  const [year, month, day] = ymd.split('-');
  return `${day}/${month}/${year}`;
}

export type ParseConsultaPublicaSuccess = {
  ok: true;
  codGen: string;
  fechaYmd: string;
  fechaDmy: string;
  ambiente: string;
  urlOriginal: string;
  urlNormalizada: string;
};

export type ParseConsultaPublicaFailure = {
  ok: false;
  error: string;
  urlOriginal?: string;
};

export type ParseConsultaPublicaResult =
  | ParseConsultaPublicaSuccess
  | ParseConsultaPublicaFailure;

export function parseConsultaPublicaUrl(
  raw: string,
  fallbackAmbiente = '01'
): ParseConsultaPublicaResult {
  try {
    const extracted = extractUrlFromText(raw);
    if (!extracted) {
      return { ok: false, error: 'El QR no contiene una URL valida.' };
    }

    const url = new URL(extracted);
    const codGen = pickQueryParam(url, COD_GEN_ALIASES);
    const fechaRaw = pickQueryParam(url, FECHA_ALIASES);
    const ambienteRaw = pickQueryParam(url, AMBIENTE_ALIASES);
    const ambiente = (ambienteRaw || fallbackAmbiente).trim() || '01';

    if (!codGen || !fechaRaw) {
      return {
        ok: false,
        error: 'El QR no contiene codigo y fecha.',
        urlOriginal: extracted,
      };
    }

    if (!isProbableCodGen(codGen)) {
      return {
        ok: false,
        error: 'Codigo de generacion invalido.',
        urlOriginal: extracted,
      };
    }

    const parsedDate = tryParseFechaFlexible(fechaRaw);
    if (!parsedDate) {
      return {
        ok: false,
        error: 'Fecha de emision invalida.',
        urlOriginal: extracted,
      };
    }

    const fechaYmd = formatDateYmd(parsedDate);
    const fechaDmy = formatDateDmy(parsedDate);
    const normalizedCodGen = codGen.trim().toUpperCase();

    return {
      ok: true,
      codGen: normalizedCodGen,
      fechaYmd,
      fechaDmy,
      ambiente,
      urlOriginal: extracted,
      urlNormalizada: buildHaciendaPublicUrl({
        ambiente,
        codigoGeneracion: normalizedCodGen,
        fecEmi: fechaYmd,
      }),
    };
  } catch {
    return { ok: false, error: 'El contenido escaneado no es una URL valida.' };
  }
}

export function buildInvalidQrResult(value: string, error: string) {
  return {
    ok: false,
    url: value,
    linkVisita: value,
    visitar: 'Abrir',
    ambiente: '',
    codGen: '',
    fechaEmi: '',
    estado: 'ERROR',
    estadoRaw: '',
    descripcionEstado: '',
    tipoDte: '',
    tipoDteNorm: '',
    fechaHoraGeneracion: '',
    fechaHoraTransmision: '',
    numeroControl: '',
    montoTotal: '',
    montoTotalOperacion: '',
    ivaOperaciones: '',
    ivaPercibido: '',
    ivaRetenido: '',
    retencionRenta: '',
    totalNoAfectos: '',
    totalPagarOperacion: '',
    otrosTributos: '',
    documentoAjustado: '',
    documentoEventoAplicado: '',
    ajustado: false,
    error,
  };
}

export type ParsedQrScanItem = {
  codGen: string;
  fechaYmd: string;
  ambiente: string;
  raw: string;
};

export function parseQrScanBatch(
  scans: string[],
  fallbackAmbiente = '01'
): {
  valid: ParsedQrScanItem[];
  invalid: ReturnType<typeof buildInvalidQrResult>[];
} {
  const valid: ParsedQrScanItem[] = [];
  const invalid: ReturnType<typeof buildInvalidQrResult>[] = [];
  const seen = new Set<string>();

  for (const raw of scans) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) continue;

    const parsed = parseConsultaPublicaUrl(trimmed, fallbackAmbiente);
    if (!parsed.ok) {
      invalid.push(buildInvalidQrResult(trimmed, parsed.error));
      continue;
    }

    const key = `${parsed.codGen}|${parsed.fechaYmd}|${parsed.ambiente}`;
    if (seen.has(key)) continue;
    seen.add(key);

    valid.push({
      codGen: parsed.codGen,
      fechaYmd: parsed.fechaYmd,
      ambiente: parsed.ambiente,
      raw: trimmed,
    });
  }

  return { valid, invalid };
}
