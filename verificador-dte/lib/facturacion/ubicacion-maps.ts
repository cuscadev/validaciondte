import maps from '@/lib/facturacion/data/ubicacion-maps.json';

export type MunicipioOficial = { codigo: string; valor: string };

export type UbicacionMaps = {
  municipiosByDepartamento: Record<string, MunicipioOficial[]>;
  distritoGeoZona?: Record<string, string>;
  zonaDistritos?: Record<string, string[]>;
};

export const ubicacionMaps = maps as UbicacionMaps;

function pad2(value: string) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.slice(-2).padStart(2, '0');
}

/** Municipios CAT-013 oficiales del departamento (codigo unico dentro del dept). */
export function municipiosForDepartamento(departamentoCodigo: string): MunicipioOficial[] {
  return ubicacionMaps.municipiosByDepartamento[pad2(departamentoCodigo)] ?? [];
}

/** Valida que el codigo de municipio exista dentro del departamento (CAT-013 oficial). */
export function isMunicipioValidForDepartamento(
  departamentoCodigo: string,
  municipioCodigo: string
): boolean {
  const muni = pad2(municipioCodigo);
  if (!muni) return false;
  return municipiosForDepartamento(departamentoCodigo).some((m) => pad2(m.codigo) === muni);
}

/** En DTE v2 el distrito es siempre requerido en la direccion. */
export function requiresDistritoForMunicipio(_municipioCodigo: string): boolean {
  return true;
}

export function geoCodigoDistrito(departamentoCodigo: string, distritoCodigo: string): string {
  const dept = pad2(departamentoCodigo);
  const distrito = pad2(distritoCodigo);
  return `${dept}${distrito}`;
}

export function distritoCodigoFromGeo(geoCodigo: string): string {
  const digits = String(geoCodigo ?? '').replace(/\D/g, '');
  if (digits.length < 2) return '';
  return digits.slice(-2).padStart(2, '0');
}

export function departamentoCodigoFromGeo(geoCodigo: string): string {
  const digits = String(geoCodigo ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return digits.slice(0, 2).padStart(2, '0');
}
