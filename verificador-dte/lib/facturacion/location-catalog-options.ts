import type { SearchableSelectOption } from '@/components/ui/searchable-select';
import { normalizeLocationCode } from '@/lib/facturacion/resolve-location';

export type LocationCatalogRow = {
  id?: number;
  codigo: string;
  nombre?: string;
  descripcion?: string;
  departamento_codigo?: string;
  municipio_id?: number;
};

export type LocationCatalogs = {
  departamentos: LocationCatalogRow[];
  municipios: LocationCatalogRow[];
  distritos: LocationCatalogRow[];
};

function catalogName(row: LocationCatalogRow) {
  return row.nombre || row.descripcion || row.codigo;
}

export function municipioSelectKey(departamentoCodigo: string, municipioCodigo: string) {
  const dept = normalizeLocationCode(departamentoCodigo);
  const muni = normalizeLocationCode(municipioCodigo);
  if (!dept || !muni) return '';
  return `${dept}:${muni}`;
}

export function distritoSelectKey(municipioId: number | string, distritoCodigo: string) {
  const distrito = normalizeLocationCode(distritoCodigo);
  if (!municipioId || !distrito) return '';
  return `${municipioId}:${distrito}`;
}

export function parseMunicipioSelectKey(key: string) {
  const trimmed = key.trim();
  if (!trimmed) return { departamentoCodigo: '', municipioCodigo: '' };

  const colonIndex = trimmed.indexOf(':');
  if (colonIndex === -1) {
    return { departamentoCodigo: '', municipioCodigo: normalizeLocationCode(trimmed) };
  }

  return {
    departamentoCodigo: normalizeLocationCode(trimmed.slice(0, colonIndex)),
    municipioCodigo: normalizeLocationCode(trimmed.slice(colonIndex + 1)),
  };
}

export function parseDistritoSelectKey(
  key: string,
  municipiosById?: Map<number, LocationCatalogRow>
) {
  const trimmed = key.trim();
  if (!trimmed) {
    return { departamentoCodigo: '', municipioCodigo: '', distritoCodigo: '' };
  }

  const colonIndex = trimmed.indexOf(':');
  if (colonIndex === -1) {
    return {
      departamentoCodigo: '',
      municipioCodigo: '',
      distritoCodigo: normalizeLocationCode(trimmed),
    };
  }

  const municipioId = trimmed.slice(0, colonIndex);
  const distritoCodigo = normalizeLocationCode(trimmed.slice(colonIndex + 1));
  const municipio = municipioId ? municipiosById?.get(Number(municipioId)) : undefined;

  return {
    departamentoCodigo: normalizeLocationCode(municipio?.departamento_codigo),
    municipioCodigo: normalizeLocationCode(municipio?.codigo),
    distritoCodigo,
  };
}

export function departamentoOptions(rows: LocationCatalogRow[]): SearchableSelectOption[] {
  return rows.map((row) => ({
    value: row.codigo,
    label: `${row.codigo} - ${catalogName(row)}`,
    description: row.descripcion,
  }));
}

export function municipioOptions(
  rows: LocationCatalogRow[],
  departamentosByCodigo?: Map<string, LocationCatalogRow>
): SearchableSelectOption[] {
  return rows.map((row) => {
    const dept = row.departamento_codigo ?? '';
    const deptName = departamentosByCodigo?.get(dept)?.nombre;
    const deptLabel = deptName ? `${dept} ${deptName}` : `Dept ${dept}`;

    return {
      value: municipioSelectKey(dept, row.codigo),
      label: `${row.codigo} - ${catalogName(row)} (${deptLabel})`,
      description: row.descripcion,
    };
  });
}

export function distritoOptions(
  rows: LocationCatalogRow[],
  municipiosById?: Map<number, LocationCatalogRow>
): SearchableSelectOption[] {
  return rows.map((row) => {
    const municipio = row.municipio_id != null ? municipiosById?.get(Number(row.municipio_id)) : undefined;
    const dept = row.departamento_codigo ?? municipio?.departamento_codigo ?? '';
    const muniCod = municipio?.codigo ?? '';
    const context = dept && muniCod ? `${dept}/${muniCod}` : String(row.municipio_id ?? '');

    return {
      value: distritoSelectKey(row.municipio_id ?? '', row.codigo),
      label: `${row.codigo} - ${catalogName(row)} (${context})`,
      description: row.descripcion,
    };
  });
}

export function resolveMunicipioSelectKey(
  catalogs: LocationCatalogs,
  departamentoCodigo: string,
  municipioCodigo: string
) {
  const dept = normalizeLocationCode(departamentoCodigo);
  const muni = normalizeLocationCode(municipioCodigo);
  if (!dept || !muni) return '';

  const match = catalogs.municipios.find(
    (row) =>
      normalizeLocationCode(row.departamento_codigo) === dept &&
      normalizeLocationCode(row.codigo) === muni
  );

  if (!match) return municipioSelectKey(dept, muni);
  return municipioSelectKey(match.departamento_codigo ?? dept, match.codigo);
}

export function resolveDistritoSelectKey(
  catalogs: LocationCatalogs,
  departamentoCodigo: string,
  municipioCodigo: string,
  distritoCodigo: string
) {
  const dept = normalizeLocationCode(departamentoCodigo);
  const muni = normalizeLocationCode(municipioCodigo);
  const distrito = normalizeLocationCode(distritoCodigo);
  if (!dept || !muni || !distrito) return '';

  const municipio = catalogs.municipios.find(
    (row) =>
      normalizeLocationCode(row.departamento_codigo) === dept &&
      normalizeLocationCode(row.codigo) === muni
  );
  if (!municipio?.id) return '';

  const match = catalogs.distritos.find(
    (row) =>
      Number(row.municipio_id) === Number(municipio.id) &&
      normalizeLocationCode(row.codigo) === distrito
  );

  if (!match) return distritoSelectKey(municipio.id, distrito);
  return distritoSelectKey(match.municipio_id ?? municipio.id, match.codigo);
}

export function municipioRequiresDistrito(
  catalogs: LocationCatalogs,
  departamentoCodigo: string,
  municipioCodigo: string
) {
  const dept = normalizeLocationCode(departamentoCodigo);
  const muni = normalizeLocationCode(municipioCodigo);
  if (!dept || !muni) return false;

  const municipio = catalogs.municipios.find(
    (row) =>
      normalizeLocationCode(row.departamento_codigo) === dept &&
      normalizeLocationCode(row.codigo) === muni
  );
  if (!municipio?.id) return false;

  return catalogs.distritos.some(
    (row) => Number(row.municipio_id) === Number(municipio.id)
  );
}

export function buildDepartamentosMap(rows: LocationCatalogRow[]) {
  return new Map(rows.map((row) => [row.codigo, row]));
}

export function buildMunicipiosByIdMap(rows: LocationCatalogRow[]) {
  return new Map(
    rows
      .filter((row): row is LocationCatalogRow & { id: number } => row.id != null)
      .map((row) => [Number(row.id), row])
  );
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
