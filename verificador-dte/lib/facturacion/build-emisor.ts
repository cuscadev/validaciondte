import { getPostgresPool } from '@/lib/postgres';
import {
  fetchEmisorEmissionContext,
  type DteEmisorInput,
} from '@/lib/facturacion/go-facturacion-client';
import {
  resolveEmitterRowLocation,
  resolveLocation,
  toDteLocationCodes,
  type ResolvedLocation,
} from '@/lib/facturacion/resolve-location';

function cleanDigits(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeNrc(value: unknown, required = false) {
  const nrc = cleanDigits(value);
  if (!nrc) return required ? '' : null;
  if (nrc.length > 8) return required ? nrc.slice(0, 8) : null;
  return nrc;
}

export function buildEmisorPayload(
  row: Record<string, unknown>,
  location: ResolvedLocation
) {
  const direccion = toDteLocationCodes(location);
  return {
    nit: cleanDigits(row.nit),
    nrc: normalizeNrc(row.nrc, true),
    nombre: getString(row.nombre),
    codActividad: getString(row.codigo_actividad),
    descActividad:
      getString(row.descripcion_actividad).trim() || getString(row.actividad_nombre).trim(),
    nombreComercial: nullableString(row.nombre_comercial),
    direccion: {
      ...direccion,
      complemento: getString(row.complemento_direccion),
    },
    telefono: getString(row.telefono),
    correo: getString(row.correo),
    codEstable: nullableString(row.cod_estable) || '001',
    codPuntoVenta: nullableString(row.cod_punto_venta) || '001',
    tipoEstablecimiento:
      getString(row.tipo_establecimiento_emision) || getString(row.tipo_establecimiento_codigo) || 'M',
  };
}

export async function fetchEmisorFromGo(firebaseUid: string, email: string) {
  const context = await fetchEmisorEmissionContext(firebaseUid, email);
  return { emisor: context.emisor, emisorId: context.emisorId };
}

export async function resolveEmitterForDte(
  row: Record<string, unknown>,
  options: { requireDistrito?: boolean; firebaseUid?: string; email?: string } = { requireDistrito: true }
) {
  if (options.firebaseUid) {
    const fromGo = await fetchEmisorFromGo(options.firebaseUid, options.email || '');
    return {
      location: await resolveEmitterRowLocation(getPostgresPool(), row, options),
      emisor: fromGo.emisor,
      emisorId: fromGo.emisorId,
    };
  }

  const location = await resolveEmitterRowLocation(getPostgresPool(), row, options);
  return {
    location,
    emisor: buildEmisorPayload(row, location),
  };
}

export async function resolveReceptorDteLocation(row: Record<string, unknown>) {
  if (!row.departamento_codigo && !row.municipio_codigo) {
    return {
      departamento: '',
      municipio: '',
      distrito: '',
    };
  }

  const location = await resolveLocation(
    getPostgresPool(),
    {
      departamentoCodigo: row.departamento_codigo,
      municipioCodigo: row.municipio_codigo,
      distritoCodigo: row.distrito_codigo,
    },
    { requireDistrito: Boolean(row.distrito_codigo) }
  );

  if (!location) {
    return { departamento: '', municipio: '', distrito: '' };
  }

  return toDteLocationCodes(location);
}
