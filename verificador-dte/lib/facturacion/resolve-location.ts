import type { Pool } from 'pg';

import {
  distritoCodigoFromGeo,
  geoCodigoDistrito,
} from '@/lib/facturacion/ubicacion-maps';

export type ResolvedLocation = {
  departamentoCodigo: string;
  municipioCodigo: string;
  distritoCodigo: string | null;
  departamento: string;
  municipio: string;
  municipioDte: string;
  distrito: string;
};

export type LocationInput = {
  departamentoCodigo?: unknown;
  municipioCodigo?: unknown;
  distritoCodigo?: unknown;
};

export class LocationValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'LocationValidationError';
    this.status = status;
  }
}

function cleanDigits(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

export function normalizeLocationCode(value: unknown): string {
  const digits = cleanDigits(value);
  if (!digits) return '';
  const normalized = digits.slice(-2).padStart(2, '0');
  return normalized === '00' ? '' : normalized;
}

/** Convierte codigos invalidos de placeholder (00) a vacio para formularios. */
export function sanitizeLocationCodeForForm(value: unknown): string {
  const normalized = normalizeLocationCode(value);
  return normalized === '00' ? '' : normalized;
}

export function isInvalidLocationCode(value: unknown): boolean {
  const normalized = normalizeLocationCode(value);
  return !normalized || normalized === '00';
}

/** Normaliza para guardar en BD (2 digitos). Rechaza 00 y vacio. */
export function sanitizeLocationCodeForStorage(value: unknown): string {
  const normalized = normalizeLocationCode(value);
  if (!normalized || normalized === '00') return '';
  return normalized;
}

/**
 * Municipio DTE = codigo CAT-013 (columna codigo en cat_013_municipio).
 * Los codigos son unicos SOLO dentro del departamento, asi que se envia tal cual.
 */
export function toDteMunicipioCode(
  _departamento: unknown,
  municipio: unknown,
  _distrito?: unknown
): string {
  return normalizeLocationCode(municipio);
}

/** Formato de municipio DTE: 2 digitos, distinto de 00. La validacion contra el
 * catalogo (departamento + municipio) se hace en resolveLocation/BD. */
export function isValidDteMunicipioCode(value: unknown, _departamento?: unknown): boolean {
  const muni = normalizeLocationCode(value);
  return /^\d{2}$/.test(muni) && muni !== '00';
}

export function normalizeDteDireccion<T extends { departamento: string; municipio: string; distrito: string }>(
  direccion: T
): T {
  const departamento = normalizeLocationCode(direccion.departamento);
  return {
    ...direccion,
    departamento,
    municipio: toDteMunicipioCode(departamento, direccion.municipio),
    distrito: normalizeLocationCode(direccion.distrito),
  };
}

export function toDteLocationCodes(location: ResolvedLocation) {
  const departamento = normalizeLocationCode(location.departamento);
  return {
    departamento,
    municipio: toDteMunicipioCode(departamento, location.municipioCodigo),
    distrito: normalizeLocationCode(location.distrito),
  };
}

type ResolveOptions = {
  requireDistrito?: boolean;
  allowEmpty?: boolean;
};

export async function resolveLocation(
  pool: Pool,
  input: LocationInput,
  options: ResolveOptions = {}
): Promise<ResolvedLocation | null> {
  const departamentoCodigo = normalizeLocationCode(input.departamentoCodigo);
  const municipioCodigo = normalizeLocationCode(input.municipioCodigo);
  const distritoCodigo = normalizeLocationCode(input.distritoCodigo);

  if (!departamentoCodigo && !municipioCodigo && !distritoCodigo) {
    if (options.allowEmpty) return null;
    throw new LocationValidationError('Departamento y municipio son obligatorios.');
  }

  if (!departamentoCodigo) {
    throw new LocationValidationError('Departamento es obligatorio.');
  }

  if (!municipioCodigo || municipioCodigo === '00') {
    throw new LocationValidationError('Municipio es obligatorio.');
  }

  const dept = await pool.query<{ codigo: string }>(
    `
      SELECT codigo
      FROM cat_012_departamento
      WHERE codigo = $1
      LIMIT 1
    `,
    [departamentoCodigo]
  );
  if (!dept.rows[0]) {
    throw new LocationValidationError(`Departamento invalido: ${departamentoCodigo}.`);
  }

  const municipio = await pool.query<{ codigo: string }>(
    `
      SELECT codigo
      FROM cat_013_municipio
      WHERE departamento_codigo = $1
        AND LPAD(TRIM(codigo), 2, '0') = $2
      LIMIT 1
    `,
    [departamentoCodigo, municipioCodigo]
  );
  if (!municipio.rows[0]) {
    throw new LocationValidationError(
      `Municipio ${municipioCodigo} no es valido para el departamento ${departamentoCodigo} segun el catalogo CAT-013 de Hacienda.`
    );
  }

  const municipioCodigoStored = normalizeLocationCode(municipio.rows[0].codigo);
  let resolvedDistrito = distritoCodigo;

  if (resolvedDistrito) {
    const distritoDigits = cleanDigits(resolvedDistrito);
    const geoCodigo =
      distritoDigits.length >= 4
        ? distritoDigits.slice(-4).padStart(4, '0')
        : geoCodigoDistrito(departamentoCodigo, resolvedDistrito);
    const distrito = await pool.query<{ codigo: string }>(
      `
        SELECT codigo
        FROM cat_008_distrito
        WHERE codigo = $1
        LIMIT 1
      `,
      [geoCodigo]
    );
    if (!distrito.rows[0]) {
      throw new LocationValidationError(
        `Distrito invalido para el departamento seleccionado (${departamentoCodigo}/${resolvedDistrito}).`
      );
    }

    resolvedDistrito = distritoCodigoFromGeo(distrito.rows[0].codigo);
  } else if (options.requireDistrito) {
    throw new LocationValidationError('Distrito es obligatorio para este tipo de documento.');
  }

  return {
    departamentoCodigo,
    municipioCodigo: municipioCodigoStored,
    distritoCodigo: resolvedDistrito || null,
    departamento: departamentoCodigo,
    municipio: municipioCodigoStored,
    municipioDte: toDteMunicipioCode(departamentoCodigo, municipioCodigoStored),
    distrito: resolvedDistrito,
  };
}

export async function resolveEmitterRowLocation(
  pool: Pool,
  row: Record<string, unknown>,
  options: ResolveOptions = {}
): Promise<ResolvedLocation> {
  const resolved = await resolveLocation(
    pool,
    {
      departamentoCodigo: row.departamento_codigo,
      municipioCodigo: row.municipio_codigo,
      distritoCodigo: row.distrito_codigo,
    },
    options
  );

  if (!resolved) {
    throw new LocationValidationError('Ubicacion del emisor incompleta.');
  }

  return resolved;
}
