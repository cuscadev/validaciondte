'use client';

import { useMemo } from 'react';

import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DteDireccionPreview } from '@/components/facturacion/DteDireccionPreview';
import {
  type LocationCatalogs,
  departamentoOptions,
  distritoOptions,
  municipioOptions,
  municipioSelectKey as buildMunicipioSelectKey,
  parseDistritoSelectKey,
  parseMunicipioSelectKey,
  resolveDistritoSelectKey,
} from '@/lib/facturacion/location-catalog-options';

export type LocationValue = {
  departamentoCodigo: string;
  municipioCodigo: string;
  distritoCodigo: string;
};

type Props = {
  catalogs: LocationCatalogs;
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  /** Texto libre de la direccion; solo se usa para la vista previa del JSON. */
  complemento?: string;
  idPrefix?: string;
  disabled?: boolean;
  /** Muestra el bloque de vista previa del JSON que se envia a Hacienda. */
  showPreview?: boolean;
  /** Clases para el contenedor de los selects (grid). */
  className?: string;
  clearable?: boolean;
};

/**
 * Selector reutilizable de ubicacion para DTE (departamento + municipio + distrito).
 *
 * Centraliza las reglas de Hacienda:
 *  - El municipio (zona CAT-013) se filtra por departamento.
 *  - El distrito (CAT-008) se filtra por departamento + municipio (cada distrito
 *    pertenece a un unico municipio/zona).
 *  - Al cambiar departamento o municipio se limpian los campos dependientes.
 *
 * Es totalmente controlado: deriva las "select keys" internas a partir de
 * `value` + `catalogs`, asi cada formulario solo maneja los 3 codigos.
 */
export function LocationSelect({
  catalogs,
  value,
  onChange,
  complemento,
  idPrefix = 'loc',
  disabled = false,
  showPreview = true,
  className,
  clearable = true,
}: Props) {
  const options = useMemo(
    () => ({
      departamentos: departamentoOptions(catalogs.departamentos),
      municipios: municipioOptions(catalogs.municipios, value.departamentoCodigo),
      distritos: distritoOptions(
        catalogs.distritos,
        value.departamentoCodigo,
        value.municipioCodigo
      ),
    }),
    [catalogs, value.departamentoCodigo, value.municipioCodigo]
  );

  const municipioKey = buildMunicipioSelectKey(value.municipioCodigo);
  const distritoKey = resolveDistritoSelectKey(
    catalogs,
    value.departamentoCodigo,
    value.municipioCodigo,
    value.distritoCodigo
  );

  function handleDepartamento(next: string) {
    if (next === value.departamentoCodigo) return;
    onChange({ departamentoCodigo: next, municipioCodigo: '', distritoCodigo: '' });
  }

  function handleMunicipio(key: string) {
    const { municipioCodigo } = parseMunicipioSelectKey(key);
    onChange({ ...value, municipioCodigo, distritoCodigo: '' });
  }

  function handleDistrito(key: string) {
    const { distritoCodigo } = parseDistritoSelectKey(key);
    onChange({ ...value, distritoCodigo });
  }

  return (
    <>
      <div
        className={
          className ?? 'grid grid-cols-1 gap-4 sm:grid-cols-3'
        }
      >
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-departamento`}>Departamento</Label>
          <SearchableSelect
            id={`${idPrefix}-departamento`}
            value={value.departamentoCodigo}
            options={options.departamentos}
            onValueChange={handleDepartamento}
            placeholder="Seleccionar departamento"
            searchPlaceholder="Buscar departamento"
            clearable={clearable}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-municipio`}>Municipio</Label>
          <SearchableSelect
            id={`${idPrefix}-municipio`}
            value={municipioKey}
            options={options.municipios}
            onValueChange={handleMunicipio}
            placeholder="Seleccionar municipio"
            searchPlaceholder="Buscar municipio"
            emptyMessage={
              value.departamentoCodigo ? 'Sin resultados' : 'Selecciona un departamento'
            }
            clearable={clearable}
            disabled={disabled || !value.departamentoCodigo}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-distrito`}>Distrito</Label>
          <SearchableSelect
            id={`${idPrefix}-distrito`}
            value={distritoKey}
            options={options.distritos}
            onValueChange={handleDistrito}
            placeholder="Seleccionar distrito"
            searchPlaceholder="Buscar distrito"
            emptyMessage={
              value.municipioCodigo ? 'Sin resultados' : 'Selecciona un municipio'
            }
            clearable={clearable}
            disabled={disabled || !value.municipioCodigo}
          />
        </div>
      </div>

      {showPreview ? (
        <DteDireccionPreview
          departamentoCodigo={value.departamentoCodigo}
          municipioCodigo={value.municipioCodigo}
          distritoCodigo={value.distritoCodigo}
          complemento={complemento}
        />
      ) : null}
    </>
  );
}
