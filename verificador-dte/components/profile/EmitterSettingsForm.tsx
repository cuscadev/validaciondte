'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/ui/searchable-select';

export type EmitterForm = {
  nit: string;
  nrc: string;
  nombre: string;
  nombreComercial: string;
  razonSocial: string;
  tipoEstablecimientoCodigo: string;
  codigoActividad: string;
  descripcionActividad: string;
  departamentoCodigo: string;
  municipioCodigo: string;
  distritoCodigo: string;
  complementoDireccion: string;
  telefono: string;
  correo: string;
  regimenTributarioCodigo: string;
  tipoAfiliacionCodigo: string;
  ambienteCodigo: string;
  rolEmisor?: string;
  certificadoPath?: string;
};

type CatalogRow = {
  id?: number;
  codigo: string;
  nombre?: string;
  descripcion?: string;
  departamento_codigo?: string;
  municipio_id?: number;
};

type ProfileCatalogs = {
  departamentos: CatalogRow[];
  municipios: CatalogRow[];
  distritos: CatalogRow[];
  tiposEstablecimiento: CatalogRow[];
  actividades: CatalogRow[];
  regimenesTributarios: CatalogRow[];
  tiposAfiliacion: CatalogRow[];
};

type Props = {
  defaultValues?: Partial<EmitterForm>;
  saveLabel?: string;
  onSaved?: (emitter: EmitterForm) => void;
};

const emptyEmitterForm: EmitterForm = {
  nit: '',
  nrc: '',
  nombre: '',
  nombreComercial: '',
  razonSocial: '',
  tipoEstablecimientoCodigo: '',
  codigoActividad: '',
  descripcionActividad: '',
  departamentoCodigo: '',
  municipioCodigo: '',
  distritoCodigo: '',
  complementoDireccion: '',
  telefono: '',
  correo: '',
  regimenTributarioCodigo: '',
  tipoAfiliacionCodigo: '',
  ambienteCodigo: '00',
};

const emptyCatalogs: ProfileCatalogs = {
  departamentos: [],
  municipios: [],
  distritos: [],
  tiposEstablecimiento: [],
  actividades: [],
  regimenesTributarios: [],
  tiposAfiliacion: [],
};

const environmentOptions: SearchableSelectOption[] = [
  { value: '00', label: '00 - Produccion' },
  { value: '01', label: '01 - Pruebas' },
];

function emitterToForm(data: Partial<EmitterForm>): EmitterForm {
  return {
    ...emptyEmitterForm,
    nit: data.nit || '',
    nrc: data.nrc || '',
    nombre: data.nombre || '',
    nombreComercial: data.nombreComercial || '',
    razonSocial: data.razonSocial || '',
    tipoEstablecimientoCodigo: data.tipoEstablecimientoCodigo || '',
    codigoActividad: data.codigoActividad || '',
    descripcionActividad: data.descripcionActividad || '',
    departamentoCodigo: data.departamentoCodigo || '',
    municipioCodigo: lastTwoDigits(data.municipioCodigo),
    distritoCodigo: lastTwoDigits(data.distritoCodigo),
    complementoDireccion: data.complementoDireccion || '',
    telefono: data.telefono || '',
    correo: data.correo || '',
    regimenTributarioCodigo: data.regimenTributarioCodigo || '',
    tipoAfiliacionCodigo: data.tipoAfiliacionCodigo || '',
    ambienteCodigo: data.ambienteCodigo || '00',
    rolEmisor: data.rolEmisor || '',
    certificadoPath: data.certificadoPath || '',
  };
}

function catalogLabel(row: CatalogRow) {
  const name = row.nombre || row.descripcion || row.codigo;
  return `${row.codigo} - ${name}`;
}

function catalogOptions(rows: CatalogRow[]): SearchableSelectOption[] {
  return rows.map((row) => ({
    value: row.codigo,
    label: catalogLabel(row),
    description: row.descripcion,
  }));
}

function lastTwoDigits(value?: string) {
  const clean = String(value || '').trim();
  return clean.length > 2 ? clean.slice(-2) : clean;
}

export function EmitterSettingsForm({
  defaultValues,
  saveLabel = 'Guardar datos de emisor',
  onSaved,
}: Props) {
  const defaultValuesKey = JSON.stringify(defaultValues ?? {});
  const [form, setForm] = useState<EmitterForm>(() =>
    emitterToForm({ ...emptyEmitterForm, ...defaultValues })
  );
  const [catalogs, setCatalogs] = useState<ProfileCatalogs>(emptyCatalogs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('Sesion expirada');

        const [emitterRes, catalogsRes] = await Promise.all([
          fetch('/api/profile/emisor', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/profile/catalogs', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const catalogsData = (await catalogsRes.json()) as {
          catalogs?: ProfileCatalogs;
          error?: string;
        };
        if (catalogsRes.ok && catalogsData.catalogs && !cancelled) {
          setCatalogs({ ...emptyCatalogs, ...catalogsData.catalogs });
        }

        const emitterData = (await emitterRes.json()) as {
          emitter?: Partial<EmitterForm>;
        };
        if (emitterRes.ok && emitterData.emitter && !cancelled) {
          setForm(emitterToForm({ ...defaultValues, ...emitterData.emitter }));
        } else if (!cancelled) {
          setForm(emitterToForm({ ...emptyEmitterForm, ...defaultValues }));
        }

        if (!catalogsRes.ok) {
          throw new Error(catalogsData.error || 'No se pudieron cargar catalogos.');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar emisor');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [defaultValuesKey]);

  const filteredMunicipios = useMemo(() => {
    if (!form.departamentoCodigo) return catalogs.municipios;
    return catalogs.municipios.filter(
      (row) => row.departamento_codigo === form.departamentoCodigo
    );
  }, [catalogs.municipios, form.departamentoCodigo]);

  const selectedMunicipio = useMemo(
    () =>
      filteredMunicipios.find(
        (row) => row.codigo === form.municipioCodigo && row.departamento_codigo === form.departamentoCodigo
      ),
    [filteredMunicipios, form.departamentoCodigo, form.municipioCodigo]
  );

  const filteredDistritos = useMemo(() => {
    if (!form.departamentoCodigo || !selectedMunicipio?.id) return [];
    return catalogs.distritos.filter(
      (row) =>
        row.departamento_codigo === form.departamentoCodigo &&
        Number(row.municipio_id) === Number(selectedMunicipio.id)
    );
  }, [catalogs.distritos, form.departamentoCodigo, selectedMunicipio?.id]);

  const selectedActividad = useMemo(
    () => catalogs.actividades.find((row) => row.codigo === form.codigoActividad),
    [catalogs.actividades, form.codigoActividad]
  );

  const options = useMemo(
    () => ({
      departamentos: catalogOptions(catalogs.departamentos),
      municipios: catalogOptions(filteredMunicipios),
      distritos: catalogOptions(filteredDistritos),
      tiposEstablecimiento: catalogOptions(catalogs.tiposEstablecimiento),
      actividades: catalogOptions(catalogs.actividades),
      regimenesTributarios: catalogOptions(catalogs.regimenesTributarios),
      tiposAfiliacion: catalogOptions(catalogs.tiposAfiliacion),
    }),
    [catalogs, filteredDistritos, filteredMunicipios]
  );

  function setField(name: keyof EmitterForm, value: string) {
    setForm((prev) => {
      if (name === 'departamentoCodigo') {
        return { ...prev, departamentoCodigo: value, municipioCodigo: '', distritoCodigo: '' };
      }

      if (name === 'municipioCodigo') {
        return { ...prev, municipioCodigo: value, distritoCodigo: '' };
      }

      if (name === 'codigoActividad') {
        const actividad = catalogs.actividades.find((row) => row.codigo === value);
        return {
          ...prev,
          codigoActividad: value,
          descripcionActividad:
            actividad?.descripcion || actividad?.nombre || prev.descripcionActividad,
        };
      }

      return { ...prev, [name]: value };
    });
  }

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setField(event.target.name as keyof EmitterForm, event.target.value);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!form.nit.trim() || !form.nrc.trim() || !form.nombre.trim()) {
      setError('NIT, NRC y nombre legal son obligatorios.');
      return;
    }

    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesion expirada');

      const res = await fetch('/api/profile/emisor', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as {
        emitter?: Partial<EmitterForm>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el emisor');

      const next = emitterToForm(data.emitter || form);
      setForm(next);
      toast.success('Datos de emisor guardados.');
      onSaved?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el emisor');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl border border-border">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="emitter-nit">NIT</Label>
          <Input id="emitter-nit" name="nit" value={form.nit} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emitter-nrc">NRC</Label>
          <Input id="emitter-nrc" name="nrc" value={form.nrc} onChange={handleChange} required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="emitter-nombre">Nombre legal</Label>
          <Input id="emitter-nombre" name="nombre" value={form.nombre} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emitter-comercial">Nombre comercial</Label>
          <Input id="emitter-comercial" name="nombreComercial" value={form.nombreComercial} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emitter-razon">Razon social</Label>
          <Input id="emitter-razon" name="razonSocial" value={form.razonSocial} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emitter-actividad">Codigo actividad</Label>
          <SearchableSelect
            id="emitter-actividad"
            name="codigoActividad"
            value={form.codigoActividad}
            options={options.actividades}
            onValueChange={(value) => setField('codigoActividad', value)}
            placeholder="Seleccionar actividad"
            searchPlaceholder="Buscar por codigo o actividad"
            clearable
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emitter-establecimiento">Tipo establecimiento</Label>
          <SearchableSelect
            id="emitter-establecimiento"
            name="tipoEstablecimientoCodigo"
            value={form.tipoEstablecimientoCodigo}
            options={options.tiposEstablecimiento}
            onValueChange={(value) => setField('tipoEstablecimientoCodigo', value)}
            placeholder="Seleccionar tipo"
            searchPlaceholder="Buscar tipo"
            clearable
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="emitter-desc-actividad">Descripcion actividad</Label>
          <Input
            id="emitter-desc-actividad"
            name="descripcionActividad"
            value={form.descripcionActividad}
            onChange={handleChange}
          />
          {selectedActividad?.descripcion && (
            <p className="text-xs text-muted-foreground">
              Descripcion del catalogo: {selectedActividad.descripcion}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="emitter-departamento">Departamento</Label>
          <SearchableSelect
            id="emitter-departamento"
            name="departamentoCodigo"
            value={form.departamentoCodigo}
            options={options.departamentos}
            onValueChange={(value) => setField('departamentoCodigo', value)}
            placeholder="Seleccionar departamento"
            searchPlaceholder="Buscar departamento"
            clearable
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emitter-municipio">Municipio</Label>
          <SearchableSelect
            id="emitter-municipio"
            name="municipioCodigo"
            value={form.municipioCodigo}
            disabled={!form.departamentoCodigo}
            options={options.municipios}
            onValueChange={(value) => setField('municipioCodigo', value)}
            placeholder={form.departamentoCodigo ? 'Seleccionar municipio' : 'Selecciona departamento primero'}
            searchPlaceholder="Buscar municipio"
            clearable
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emitter-distrito">Distrito</Label>
          <SearchableSelect
            id="emitter-distrito"
            name="distritoCodigo"
            value={form.distritoCodigo}
            disabled={!form.municipioCodigo}
            options={options.distritos}
            onValueChange={(value) => setField('distritoCodigo', value)}
            placeholder={
              form.municipioCodigo ? 'Seleccionar distrito' : 'Selecciona municipio primero'
            }
            searchPlaceholder="Buscar distrito"
            clearable
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emitter-ambiente">Ambiente</Label>
          <SearchableSelect
            id="emitter-ambiente"
            name="ambienteCodigo"
            value={form.ambienteCodigo}
            options={environmentOptions}
            onValueChange={(value) => setField('ambienteCodigo', value)}
            placeholder="Seleccionar ambiente"
            searchPlaceholder="Buscar ambiente"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="emitter-direccion">Complemento direccion</Label>
          <textarea
            id="emitter-direccion"
            name="complementoDireccion"
            value={form.complementoDireccion}
            onChange={handleChange}
            rows={3}
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emitter-phone">Telefono</Label>
          <Input id="emitter-phone" name="telefono" value={form.telefono} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emitter-email">Correo fiscal</Label>
          <Input id="emitter-email" name="correo" type="email" value={form.correo} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emitter-regimen">Regimen tributario</Label>
          <SearchableSelect
            id="emitter-regimen"
            name="regimenTributarioCodigo"
            value={form.regimenTributarioCodigo}
            options={options.regimenesTributarios}
            onValueChange={(value) => setField('regimenTributarioCodigo', value)}
            placeholder="Seleccionar regimen"
            searchPlaceholder="Buscar regimen"
            clearable
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emitter-afiliacion">Tipo afiliacion</Label>
          <SearchableSelect
            id="emitter-afiliacion"
            name="tipoAfiliacionCodigo"
            value={form.tipoAfiliacionCodigo}
            options={options.tiposAfiliacion}
            onValueChange={(value) => setField('tipoAfiliacionCodigo', value)}
            placeholder="Seleccionar afiliacion"
            searchPlaceholder="Buscar afiliacion"
            clearable
          />
        </div>
      </div>

      {form.certificadoPath && (
        <p className="rounded-xl border border-border px-4 py-3 text-xs text-muted-foreground">
          Certificado asociado: {form.certificadoPath}
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={saving}
        className="h-12 w-full rounded-xl bg-primary font-bold text-black hover:bg-primary/90"
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <Save className="mr-2 size-4" />
            {saveLabel}
          </>
        )}
      </Button>
    </form>
  );
}
