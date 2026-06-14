import { getGoDteApiUrl } from '@/lib/go-dte-api';

export type DteEmisorInput = {
  nit: string;
  nrc: string;
  nombre: string;
  codActividad: string;
  descActividad: string;
  nombreComercial?: string | null;
  tipoEstablecimiento?: string;
  direccion: {
    departamento: string;
    municipio: string;
    distrito: string;
    complemento: string;
  };
  telefono: string;
  correo: string;
  codEstable?: string | null;
  codPuntoVenta?: string | null;
};

export type EmisorEmissionContext = {
  emisorId: number;
  emisor: DteEmisorInput;
  establecimiento: string;
  puntoVenta: string;
  establecimientoTipo: string;
};

export type DteSequenceResult = {
  correlativo: number;
  numeroControl: string;
};

export class GoFacturacionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GoFacturacionError';
    this.status = status;
  }
}

export function goInternalHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  const key = process.env.GO_DTE_INTERNAL_API_KEY?.trim();
  if (key) headers['X-Go-Dte-Internal-Key'] = key;
  return headers;
}

export function parseGoUpstreamError(
  payload: unknown,
  fallback: string,
  status: number
): string {
  const record = asRecord(payload);
  const message = getString(record.message);
  const error = getString(record.error);
  if (message) return message;
  if (error && error !== 'true') return error;
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  return fallback || `Go API respondio HTTP ${status}`;
}

function internalHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  const key = process.env.GO_DTE_INTERNAL_API_KEY?.trim();
  if (key) headers['X-Go-Dte-Internal-Key'] = key;
  if (extra) {
    for (const [name, value] of Object.entries(extra as Record<string, string>)) {
      headers[name] = value;
    }
  }
  return headers;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function defaultCode(value: unknown, fallback: string) {
  const trimmed = getString(value).replace(/\D/g, '');
  if (!trimmed) return fallback;
  return trimmed.padStart(3, '0').slice(-3);
}

export async function postGoFacturacion<T = unknown>(
  path: string,
  body: unknown,
  init?: RequestInit
): Promise<T> {
  const upstream = await fetch(`${getGoDteApiUrl()}${path}`, {
    method: 'POST',
    headers: internalHeaders(init?.headers),
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const text = await upstream.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!upstream.ok) {
    const record = asRecord(payload);
    throw new GoFacturacionError(
      getString(record.error) || text || `Go API respondio HTTP ${upstream.status}`,
      upstream.status
    );
  }

  return payload as T;
}

export async function fetchGoFacturacion<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const upstream = await fetch(`${getGoDteApiUrl()}${path}`, {
    method: 'GET',
    headers: internalHeaders(init?.headers),
    cache: 'no-store',
  });

  const text = await upstream.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!upstream.ok) {
    const record = asRecord(payload);
    throw new GoFacturacionError(
      getString(record.error) || text || `Go API respondio HTTP ${upstream.status}`,
      upstream.status
    );
  }

  return payload as T;
}

export async function fetchEmisorDteInput(
  firebaseUid: string,
  email: string
): Promise<DteEmisorInput> {
  const response = await fetchGoFacturacion<{ emisor?: DteEmisorInput }>(
    '/api/emisores/me/dte-input',
    {
      headers: {
        'X-Firebase-UID': firebaseUid,
        'X-User-Email': email,
      },
    }
  );

  const emisor = response.emisor;
  if (!emisor?.nit) {
    throw new GoFacturacionError('No hay emisor vinculado para este usuario.', 404);
  }
  return emisor;
}

export async function fetchEmisorEmissionContext(
  firebaseUid: string,
  email: string
): Promise<EmisorEmissionContext> {
  const response = await fetchGoFacturacion<{
    emisor?: DteEmisorInput;
    emisorId?: number;
    id?: number;
  }>('/api/emisores/me/dte-input', {
    headers: {
      'X-Firebase-UID': firebaseUid,
      'X-User-Email': email,
    },
  });

  const emisor = response.emisor;
  const emisorId = Number(response.emisorId ?? response.id ?? 0);
  if (!emisor?.nit || !emisorId) {
    throw new GoFacturacionError('No hay emisor vinculado para este usuario.', 404);
  }

  const establecimiento = defaultCode(emisor.codEstable, '001');
  const puntoVenta = defaultCode(emisor.codPuntoVenta, '001');
  const establecimientoTipo = getString(emisor.tipoEstablecimiento).trim().slice(0, 1).toUpperCase() || 'M';

  return {
    emisorId,
    emisor,
    establecimiento,
    puntoVenta,
    establecimientoTipo,
  };
}

export async function fetchNextDteSequence(input: {
  emisorId: number;
  nit: string;
  tipoDte: string;
  establecimiento?: string;
  puntoEmision?: string;
}): Promise<DteSequenceResult> {
  const response = await postGoFacturacion<{
    correlativo?: number;
    numeroControl?: string;
  }>('/api/facturacion/sequences/next', {
    emisorId: input.emisorId,
    nit: input.nit,
    tipoDte: input.tipoDte,
    establecimiento: input.establecimiento ?? '001',
    puntoEmision: input.puntoEmision ?? '001',
  });

  return {
    correlativo: Number(response.correlativo ?? 0),
    numeroControl: getString(response.numeroControl),
  };
}

export function validateEmisorForEmission(emisor: DteEmisorInput) {
  if (!emisor.codActividad || !emisor.descActividad) {
    throw new GoFacturacionError(
      'Configura el codigo y descripcion de actividad economica del emisor antes de facturar.',
      400
    );
  }
  if (!emisor.direccion?.departamento || !emisor.direccion?.municipio || !emisor.direccion?.distrito) {
    throw new GoFacturacionError(
      'Configura departamento, municipio y distrito validos del emisor antes de facturar.',
      400
    );
  }
  if (!/^\d{2}$/.test(emisor.direccion.municipio)) {
    throw new GoFacturacionError(
      `Municipio del emisor invalido para DTE: ${emisor.direccion.municipio}. Debe tener 2 digitos.`,
      400
    );
  }
  if (emisor.direccion.municipio === '00') {
    throw new GoFacturacionError(
      'Municipio del emisor invalido (00). Ve a Perfil / Datos del emisor y selecciona departamento, municipio y distrito validos.',
      400
    );
  }
  if (emisor.direccion.distrito === '00') {
    throw new GoFacturacionError(
      'Distrito del emisor invalido (00). Ve a Perfil / Datos del emisor y selecciona un distrito valido.',
      400
    );
  }
}

export function resolveEmissionEnvironment(
  requested?: 'test' | 'production',
  ambienteCodigo?: string | null
): 'test' | 'production' {
  if (requested === 'production' || requested === 'test') {
    return requested;
  }
  const code = getString(ambienteCodigo).trim();
  if (code === '01') return 'production';
  return 'test';
}

export function ambienteDteCode(environment: 'test' | 'production') {
  return environment === 'production' ? '01' : '00';
}

export async function buildDocumentSequenceFields(
  context: EmisorEmissionContext,
  tipoDte: string
) {
  const sequence = await fetchNextDteSequence({
    emisorId: context.emisorId,
    nit: context.emisor.nit,
    tipoDte,
    establecimiento: context.establecimiento,
    puntoEmision: context.puntoVenta,
  });

  return {
    correlativo: sequence.correlativo,
    numeroControl: sequence.numeroControl,
    establecimiento: context.establecimiento,
    puntoVenta: context.puntoVenta,
    establecimientoTipo: context.establecimientoTipo,
  };
}
