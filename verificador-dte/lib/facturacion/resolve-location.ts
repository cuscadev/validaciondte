import type { Pool } from 'pg';

export type ResolvedLocation = {
  departamentoCodigo: string;
  municipioCodigo: string;
  distritoCodigo: string | null;
  departamento: string;
  municipio: string;
  municipioDte: string;
  distrito: string;
  municipioId: number;
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
  return digits.slice(-2).padStart(2, '0');
}

/** Convierte codigos invalidos de placeholder (00) a vacio para formularios. */
export function sanitizeLocationCodeForForm(value: unknown): string {
  const normalized = normalizeLocationCode(value);
  return normalized === '00' ? '' : normalized;
}

/** CAT-013: municipio en JSON DTE = 2 digitos (sufijo oficial). codigo_dte (4 digitos) se usa solo como referencia. */
export function toDteMunicipioCode(
  _departamento: unknown,
  municipio: unknown,
  codigoDte?: unknown
): string {
  const official = cleanDigits(codigoDte);
  if (official.length >= 4) {
    return official.slice(-2).padStart(2, '0');
  }

  const digits = cleanDigits(municipio);
  if (digits.length >= 4) {
    return digits.slice(-2).padStart(2, '0');
  }

  return normalizeLocationCode(municipio);
}

export function isValidDteMunicipioCode(value: unknown): boolean {
  const code = normalizeLocationCode(value);
  return /^\d{2}$/.test(code) && code !== '00';
}

export function normalizeDteDireccion<T extends { departamento: string; municipio: string; distrito: string }>(
  direccion: T,
  municipioDte?: string
): T {
  const departamento = normalizeLocationCode(direccion.departamento);
  return {
    ...direccion,
    departamento,
    municipio: toDteMunicipioCode(departamento, direccion.municipio, municipioDte),
    distrito: normalizeLocationCode(direccion.distrito),
  };
}

export function toDteLocationCodes(location: ResolvedLocation) {
  const departamento = normalizeLocationCode(location.departamento);
  return {
    departamento,
    municipio: location.municipioDte || toDteMunicipioCode(departamento, location.municipio),
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

  if (!municipioCodigo) {
    throw new LocationValidationError('Municipio es obligatorio.');
  }

  const dept = await pool.query<{ codigo: string }>(
    `
      SELECT codigo
      FROM cat_005_departamentos
      WHERE codigo = $1
        AND COALESCE(activo, TRUE) = TRUE
      LIMIT 1
    `,
    [departamentoCodigo]
  );
  if (!dept.rows[0]) {
    throw new LocationValidationError(`Departamento invalido: ${departamentoCodigo}.`);
  }

  const municipio = await pool.query<{ id: number; codigo: string; codigo_dte: string | null }>(
    `
      SELECT id, codigo, codigo_dte
      FROM cat_006_municipios
      WHERE codigo = $1
        AND departamento_codigo = $2
        AND COALESCE(activo, TRUE) = TRUE
      LIMIT 1
    `,
    [municipioCodigo, departamentoCodigo]
  );
  if (!municipio.rows[0]) {
    throw new LocationValidationError(
      `Municipio invalido para el departamento seleccionado (${departamentoCodigo}/${municipioCodigo}).`
    );
  }

  const municipioId = municipio.rows[0].id;
  const municipioDte = toDteMunicipioCode(
    departamentoCodigo,
    municipio.rows[0].codigo,
    municipio.rows[0].codigo_dte
  );
  let resolvedDistrito = distritoCodigo;

  if (resolvedDistrito) {
    const distrito = await pool.query<{ codigo: string }>(
      `
        SELECT codigo
        FROM cat_008_distritos
        WHERE municipio_id = $1
          AND departamento_codigo = $2
          AND codigo = $3
          AND COALESCE(activo, TRUE) = TRUE
        LIMIT 1
      `,
      [municipioId, departamentoCodigo, resolvedDistrito]
    );
    if (!distrito.rows[0]) {
      throw new LocationValidationError(
        `Distrito invalido para el municipio seleccionado (${departamentoCodigo}/${municipioCodigo}/${resolvedDistrito}).`
      );
    }
    resolvedDistrito = distrito.rows[0].codigo;
  } else if (options.requireDistrito) {
    throw new LocationValidationError('Distrito es obligatorio para este tipo de documento.');
  }

  return {
    departamentoCodigo,
    municipioCodigo: municipio.rows[0].codigo,
    distritoCodigo: resolvedDistrito || null,
    departamento: departamentoCodigo,
    municipio: municipio.rows[0].codigo,
    municipioDte,
    distrito: resolvedDistrito,
    municipioId,
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
