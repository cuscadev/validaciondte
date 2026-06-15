import type { SearchableSelectOption } from '@/components/ui/searchable-select';
import {
  distritoCodigoFromGeo,
  geoCodigoDistrito,
  requiresDistritoForMunicipio,
} from '@/lib/facturacion/ubicacion-maps';
import { normalizeLocationCode, toDteMunicipioCode } from '@/lib/facturacion/resolve-location';

export type LocationCatalogRow = {
  id?: number;
  codigo: string;
  departamento_codigo?: string;
  municipio_codigo?: string;
  codigo_dte?: string;
  valor?: string;
  nombre?: string;
  descripcion?: string;
};

function pad2(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.slice(-2).padStart(2, '0');
}

export type LocationCatalogs = {
  departamentos: LocationCatalogRow[];
  municipios: LocationCatalogRow[];
  distritos: LocationCatalogRow[];
};

function catalogValor(row: LocationCatalogRow) {
  return row.valor || row.nombre || row.descripcion || row.codigo;
}

/** Municipio CAT-013: codigo global 2 digitos. */
export function municipioSelectKey(municipioCodigo: string) {
  return normalizeLocationCode(municipioCodigo);
}

/** Distrito CAT-008: codigo unico en catalogo (4 digitos dept + distrito DTE). */
export function distritoSelectKey(codigo: string) {
  const digits = codigo.replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(-4).padStart(4, '0');
  if (digits.length >= 2) return digits.padStart(4, '0');
  return '';
}

export function parseMunicipioSelectKey(key: string) {
  return { municipioCodigo: normalizeLocationCode(key) };
}

export function parseDistritoSelectKey(key: string) {
  const catalogCodigo = String(key ?? '').trim();
  const geo = distritoSelectKey(catalogCodigo);
  const distritoCodigo = geo ? distritoCodigoFromGeo(geo) : normalizeLocationCode(catalogCodigo);
  return { distritoCodigo, distritoCatalogoCodigo: geo || catalogCodigo };
}

export function departamentoOptions(rows: LocationCatalogRow[]): SearchableSelectOption[] {
  return rows.map((row) => ({
    value: row.codigo,
    label: `${row.codigo} - ${catalogValor(row)}`,
    description: row.descripcion,
  }));
}

/**
 * Municipios CAT-013 del departamento. Los codigos se repiten entre
 * departamentos, por eso SIEMPRE se filtra por el departamento seleccionado.
 */
export function municipioOptions(
  rows: LocationCatalogRow[],
  departamentoCodigo?: string
): SearchableSelectOption[] {
  const dept = pad2(departamentoCodigo);
  const filtered = dept
    ? rows.filter((row) => pad2(row.departamento_codigo) === dept)
    : rows;
  return filtered.map((row) => ({
    value: municipioSelectKey(row.codigo),
    label: `${pad2(row.codigo)} - ${catalogValor(row)}`,
    description: row.descripcion,
  }));
}

/**
 * Distrito CAT-008 del municipio (zona). Cada distrito pertenece a un unico
 * municipio CAT-013, por eso SIEMPRE se filtra por departamento + municipio.
 * value = columna codigo del catalogo (4 digitos geo). El codigo DTE (2 digitos)
 * se muestra en la etiqueta.
 */
export function distritoOptions(
  rows: LocationCatalogRow[],
  departamentoCodigo?: string,
  municipioCodigo?: string
): SearchableSelectOption[] {
  const dept = pad2(departamentoCodigo);
  const muni = pad2(municipioCodigo);
  const filtered = rows.filter((row) => {
    if (dept && pad2(row.departamento_codigo) !== dept) return false;
    if (muni && pad2(row.municipio_codigo) !== muni) return false;
    return true;
  });
  return filtered.map((row) => {
    const catalogCodigo = distritoSelectKey(row.codigo) || normalizeLocationCode(row.codigo);
    const distritoDte =
      pad2(row.codigo_dte) ||
      (catalogCodigo.length >= 4 ? distritoCodigoFromGeo(catalogCodigo) : normalizeLocationCode(row.codigo));
    return {
      value: row.codigo,
      label: `${distritoDte} - ${catalogValor(row)}`,
      description: row.descripcion,
    };
  });
}

export function resolveMunicipioSelectKey(
  _catalogs: LocationCatalogs,
  _departamentoCodigo: string,
  municipioCodigo: string
) {
  return municipioSelectKey(municipioCodigo);
}

export function resolveDistritoSelectKey(
  catalogs: LocationCatalogs,
  departamentoCodigo: string,
  _municipioCodigo: string,
  distritoCodigo: string
) {
  const dept = normalizeLocationCode(departamentoCodigo);
  const distrito = normalizeLocationCode(distritoCodigo);
  if (!distrito) return '';

  if (dept) {
    const geo = geoCodigoDistrito(dept, distrito);
    const match = catalogs.distritos.find((row) => distritoSelectKey(row.codigo) === geo);
    return match?.codigo ?? '';
  }

  const match = catalogs.distritos.find((row) => row.codigo === distrito || row.codigo === distrito.padStart(4, '0'));
  if (match) return match.codigo;

  const matchBySuffix = catalogs.distritos.find(
    (row) => distritoCodigoFromGeo(distritoSelectKey(row.codigo)) === distrito
  );
  return matchBySuffix?.codigo ?? '';
}

export function municipioRequiresDistrito(
  _catalogs: LocationCatalogs,
  _departamentoCodigo: string,
  municipioCodigo: string
) {
  return requiresDistritoForMunicipio(municipioCodigo);
}

export type DteDireccionPreview = {
  departamento: string;
  municipio: string;
  distrito: string;
  complemento: string;
};

/** Vista previa del bloque direccion que se envia a Hacienda (codigos 2 digitos). */
export function buildDteDireccionPreview(
  departamentoCodigo: string,
  municipioCodigo: string,
  distritoCodigo: string,
  complemento?: string
): DteDireccionPreview | null {
  const departamento = normalizeLocationCode(departamentoCodigo);
  const municipio = normalizeLocationCode(municipioCodigo);
  const distrito = normalizeLocationCode(distritoCodigo);
  if (!departamento || !municipio) return null;

  return {
    departamento,
    municipio: toDteMunicipioCode(departamento, municipio, distrito),
    distrito,
    complemento: String(complemento ?? '').trim(),
  };
}

export function buildDepartamentosMap(rows: LocationCatalogRow[]) {
  return new Map(rows.map((row) => [row.codigo, row]));
}

export function syncLocationSelectKeys(
  catalogs: LocationCatalogs,
  departamentoCodigo: string,
  municipioCodigo: string,
  distritoCodigo: string
) {
  return {
    municipioSelectKey: resolveMunicipioSelectKey(catalogs, departamentoCodigo, municipioCodigo),
    distritoSelectKey: resolveDistritoSelectKey(
      catalogs,
      departamentoCodigo,
      municipioCodigo,
      distritoCodigo
    ),
  };
}
