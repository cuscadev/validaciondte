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
    descripcionEstado: '',
    tipoDte: '',
    numeroControl: '',
    montoTotal: '',
    error,
  };
}
