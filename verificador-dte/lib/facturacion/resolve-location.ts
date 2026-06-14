import type { Pool } from 'pg';

export type ResolvedLocation = {
  departamentoCodigo: string;
  municipioCodigo: string;
  distritoCodigo: string | null;
  departamento: string;
  municipio: string;
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

export function toDteLocationCodes(location: ResolvedLocation) {
  return {
    departamento: location.departamento,
    municipio: location.municipio,
    distrito: location.distrito,
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

  const municipio = await pool.query<{ id: number; codigo: string }>(
    `
      SELECT id, codigo
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
