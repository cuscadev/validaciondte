import { getGoDteApiUrl } from '@/lib/go-dte-api';
import { getPostgresPool } from '@/lib/postgres';
import {
  isValidDteMunicipioCode,
  LocationValidationError,
  normalizeDteDireccion,
  resolveEmitterRowLocation,
  toDteLocationCodes,
} from '@/lib/facturacion/resolve-location';

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

function mapRowToDteEmisorInput(row: Record<string, unknown>): DteEmisorInput {
  const str = (value: unknown) => getString(value).trim();
  const nullable = (value: unknown) => {
    const trimmed = str(value);
    return trimmed || null;
  };

  return {
    nit: str(row.nit),
    nrc: str(row.nrc),
    nombre: str(row.nombre),
    codActividad: str(row.codigo_actividad),
    descActividad: str(row.descripcion_actividad),
    nombreComercial: nullable(row.nombre_comercial),
    tipoEstablecimiento: str(row.tipo_establecimiento_emision).slice(0, 1).toUpperCase() || 'M',
    direccion: normalizeDteDireccion({
      departamento: str(row.departamento_codigo),
      municipio: str(row.municipio_codigo),
      distrito: str(row.distrito_codigo),
      complemento: str(row.complemento_direccion),
    }),
    telefono: str(row.telefono),
    correo: str(row.correo),
    codEstable: str(row.cod_estable) || '001',
    codPuntoVenta: str(row.cod_punto_venta) || '001',
  };
}

async function fetchLinkedEmisorRow(firebaseUid: string, email: string) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        e.id,
        e.nit,
        e.nrc,
        e.nombre,
        e.nombre_comercial,
        e.razon_social,
        e.tipo_establecimiento_codigo,
        e.codigo_actividad,
        COALESCE(NULLIF(BTRIM(e.descripcion_actividad), ''), a.nombre) AS descripcion_actividad,
        e.departamento_codigo,
        e.municipio_codigo,
        e.distrito_codigo,
        e.complemento_direccion,
        e.telefono,
        e.correo,
        COALESCE(NULLIF(BTRIM(ec.cod_estable), ''), '001') AS cod_estable,
        COALESCE(NULLIF(BTRIM(ec.cod_punto_venta), ''), '001') AS cod_punto_venta,
        COALESCE(
          NULLIF(BTRIM(ec.tipo_establecimiento_emision), ''),
          NULLIF(BTRIM(e.tipo_establecimiento_codigo), ''),
          'M'
        ) AS tipo_establecimiento_emision
      FROM usuarios u
      INNER JOIN usuario_emisor ue ON ue.usuario_id = u.id
      INNER JOIN emisores e ON e.id = ue.emisor_id
      LEFT JOIN cat_024_codigo_actividad a ON a.codigo = e.codigo_actividad
      LEFT JOIN emisor_configuracion ec ON ec.emisor_id = e.id
      WHERE u.activo = TRUE
        AND e.activo = TRUE
        AND (u.firebase_uid = $1 OR lower(u.email) = lower($2))
      ORDER BY
        CASE ue.rol WHEN 'propietario' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
        e.id ASC
      LIMIT 1
    `,
    [firebaseUid, email]
  );

  return result.rows[0] as Record<string, unknown> | undefined;
}

export async function fetchEmisorDteInput(
  firebaseUid: string,
  email: string
): Promise<DteEmisorInput> {
  const context = await fetchEmisorEmissionContext(firebaseUid, email);
  return context.emisor;
}

export async function fetchEmisorEmissionContext(
  firebaseUid: string,
  email: string
): Promise<EmisorEmissionContext> {
  const linkedRow = await fetchLinkedEmisorRow(firebaseUid, email);
  if (!linkedRow?.nit) {
    throw new GoFacturacionError(
      'No hay emisor vinculado a tu usuario. Guarda los datos del emisor en Configuraciones antes de facturar.',
      404
    );
  }

  const emisorId = Number(linkedRow.id ?? 0);
  if (!emisorId) {
    throw new GoFacturacionError(
      'No hay emisor vinculado a tu usuario. Guarda los datos del emisor en Configuraciones antes de facturar.',
      404
    );
  }

  const emisor = mapRowToDteEmisorInput(linkedRow);
  const establecimiento = defaultCode(emisor.codEstable, '001');
  const puntoVenta = defaultCode(emisor.codPuntoVenta, '001');
  const establecimientoTipo = getString(emisor.tipoEstablecimiento).trim().slice(0, 1).toUpperCase() || 'M';

  const pool = getPostgresPool();

  let direccionDte;
  try {
    const location = await resolveEmitterRowLocation(
      pool,
      {
        departamento_codigo: linkedRow.departamento_codigo,
        municipio_codigo: linkedRow.municipio_codigo,
        distrito_codigo: linkedRow.distrito_codigo,
        complemento_direccion: linkedRow.complemento_direccion,
      },
      { requireDistrito: true }
    );
    direccionDte = toDteLocationCodes(location);
  } catch (error) {
    if (error instanceof LocationValidationError) {
      throw new GoFacturacionError(
        'Completa departamento, municipio y distrito validos del emisor en Configuraciones antes de facturar.',
        400
      );
    }
    throw error;
  }

  const complemento =
    getString(linkedRow.complemento_direccion).trim() || getString(emisor.direccion?.complemento);

  return {
    emisorId,
    emisor: {
      ...emisor,
      direccion: {
        departamento: direccionDte.departamento,
        municipio: direccionDte.municipio,
        distrito: direccionDte.distrito,
        complemento,
      },
    },
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
  const direccion = normalizeDteDireccion(emisor.direccion);
  if (!direccion.departamento || !direccion.municipio || !direccion.distrito) {
    throw new GoFacturacionError(
      'Configura departamento, municipio y distrito validos del emisor antes de facturar.',
      400
    );
  }
  if (!isValidDteMunicipioCode(direccion.municipio, direccion.departamento)) {
    throw new GoFacturacionError(
      `Municipio del emisor invalido para Hacienda: ${emisor.direccion.municipio}. Usa el codigo CAT-013 del catalogo (columna codigo, ej. 30 o 34), no el id ni el codigo del distrito.`,
      400
    );
  }
  if (direccion.distrito === '00') {
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
