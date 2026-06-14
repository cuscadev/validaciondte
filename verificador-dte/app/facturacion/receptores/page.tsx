'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  UsersRound,
} from 'lucide-react';

import { auth } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/ui/searchable-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type CatalogRow = {
  id?: number;
  codigo: string;
  nombre?: string;
  descripcion?: string;
  departamento_codigo?: string;
  municipio_id?: number;
};

type ReceptorCatalogs = {
  tiposDocumento: CatalogRow[];
  departamentos: CatalogRow[];
  municipios: CatalogRow[];
  distritos: CatalogRow[];
  actividades: CatalogRow[];
  regimenesTributarios: CatalogRow[];
  paises: CatalogRow[];
};

type Receptor = {
  id: number;
  tipoDocumentoCodigo: string;
  tipoDocumentoNombre?: string;
  numeroDocumento: string;
  nombre: string;
  nombreComercial?: string;
  razonSocial?: string;
  telefono?: string;
  correo?: string;
  departamentoCodigo?: string;
  departamentoNombre?: string;
  municipioCodigo?: string;
  municipioNombre?: string;
  distritoCodigo?: string;
  complementoDireccion?: string;
  nrc?: string;
  codigoActividad?: string;
  actividadNombre?: string;
  regimenTributarioCodigo?: string;
  tipoCliente?: string;
  esConsumidorFinal?: boolean;
  paisCodigo?: string;
  paisNombre?: string;
  codDomiciliado?: number;
  usoPreferente?: string;
  activo?: boolean;
  datosCompletados?: boolean;
};

type ReceptorForm = {
  id?: number;
  tipoDocumentoCodigo: string;
  numeroDocumento: string;
  nombre: string;
  nombreComercial: string;
  razonSocial: string;
  telefono: string;
  correo: string;
  departamentoCodigo: string;
  municipioCodigo: string;
  distritoCodigo: string;
  complementoDireccion: string;
  nrc: string;
  codigoActividad: string;
  regimenTributarioCodigo: string;
  tipoCliente: string;
  esConsumidorFinal: boolean;
  paisCodigo: string;
  codDomiciliado: number;
  usoPreferente: string;
};

const emptyForm: ReceptorForm = {
  tipoDocumentoCodigo: '02',
  numeroDocumento: '',
  nombre: '',
  nombreComercial: '',
  razonSocial: '',
  telefono: '',
  correo: '',
  departamentoCodigo: '',
  municipioCodigo: '',
  distritoCodigo: '',
  complementoDireccion: '',
  nrc: '',
  codigoActividad: '',
  regimenTributarioCodigo: '',
  tipoCliente: 'persona_natural',
  esConsumidorFinal: false,
  paisCodigo: 'SV',
  codDomiciliado: 0,
  usoPreferente: 'facturacion',
};

const emptyCatalogs: ReceptorCatalogs = {
  tiposDocumento: [],
  departamentos: [],
  municipios: [],
  distritos: [],
  actividades: [],
  regimenesTributarios: [],
  paises: [],
};

const tipoClienteOptions: SearchableSelectOption[] = [
  { value: 'persona_natural', label: 'Persona natural' },
  { value: 'persona_juridica', label: 'Persona juridica' },
  { value: 'extranjero', label: 'Extranjero' },
];

const usoOptions: SearchableSelectOption[] = [
  { value: 'facturacion', label: 'Facturacion' },
  { value: 'reportes', label: 'Reportes' },
];

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

async function firebaseToken() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sesion no autorizada');
  return token;
}

function formFromReceptor(row: Receptor): ReceptorForm {
  return {
    id: row.id,
    tipoDocumentoCodigo: row.tipoDocumentoCodigo || '02',
    numeroDocumento: row.numeroDocumento || '',
    nombre: row.nombre || '',
    nombreComercial: row.nombreComercial || '',
    razonSocial: row.razonSocial || '',
    telefono: row.telefono || '',
    correo: row.correo || '',
    departamentoCodigo: row.departamentoCodigo || '',
    municipioCodigo: lastTwoDigits(row.municipioCodigo),
    distritoCodigo: lastTwoDigits(row.distritoCodigo),
    complementoDireccion: row.complementoDireccion || '',
    nrc: row.nrc || '',
    codigoActividad: row.codigoActividad || '',
    regimenTributarioCodigo: row.regimenTributarioCodigo || '',
    tipoCliente: row.tipoCliente || 'persona_natural',
    esConsumidorFinal: Boolean(row.esConsumidorFinal),
    paisCodigo: row.paisCodigo || 'SV',
    codDomiciliado: Number(row.codDomiciliado || 0),
    usoPreferente: row.usoPreferente || 'facturacion',
  };
}

export default function FacturacionReceptoresPage() {
  const { appUser, authChecked } = useAuth();
  const [catalogs, setCatalogs] = useState<ReceptorCatalogs>(emptyCatalogs);
  const [rows, setRows] = useState<Receptor[]>([]);
  const [form, setForm] = useState<ReceptorForm>(emptyForm);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canAccess =
    appUser?.role === 'superadmin' ||
    appUser?.role === 'cliente' ||
    appUser?.role === 'colaborador';

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

  const optionGroups = useMemo(
    () => ({
      tiposDocumento: catalogOptions(catalogs.tiposDocumento),
      departamentos: catalogOptions(catalogs.departamentos),
      municipios: catalogOptions(filteredMunicipios),
      distritos: catalogOptions(filteredDistritos),
      actividades: catalogOptions(catalogs.actividades),
      regimenesTributarios: catalogOptions(catalogs.regimenesTributarios),
      paises: catalogOptions(catalogs.paises),
    }),
    [catalogs, filteredDistritos, filteredMunicipios]
  );

  async function loadData(search = query) {
    setLoading(true);
    setError('');

    try {
      const token = await firebaseToken();
      const [catalogsRes, receptorsRes] = await Promise.all([
        fetch('/api/profile/catalogs', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/facturacion/receptors?q=${encodeURIComponent(search)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const catalogsPayload = await catalogsRes.json();
      const receptorsPayload = await receptorsRes.json();

      if (!catalogsRes.ok) {
        throw new Error(catalogsPayload.error || 'No se pudieron cargar catalogos');
      }
      if (!receptorsRes.ok) {
        throw new Error(receptorsPayload.error || 'No se pudieron cargar receptores');
      }

      setCatalogs({ ...emptyCatalogs, ...catalogsPayload.catalogs });
      setRows(receptorsPayload.receptors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar receptores');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authChecked || !canAccess) return;
    void loadData('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, canAccess]);

  function setField(name: keyof ReceptorForm, value: string | boolean | number) {
    setForm((current) => {
      if (name === 'departamentoCodigo') {
        return { ...current, departamentoCodigo: String(value), municipioCodigo: '', distritoCodigo: '' };
      }

      if (name === 'municipioCodigo') {
        return { ...current, municipioCodigo: String(value), distritoCodigo: '' };
      }

      return { ...current, [name]: value };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = await firebaseToken();
      const res = await fetch('/api/facturacion/receptors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          datosCompletados: Boolean(
            form.numeroDocumento &&
              form.nombre &&
              form.correo &&
              form.complementoDireccion
          ),
        }),
      });
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error || 'No se pudo guardar receptor');
      }

      setSuccess('Receptor guardado correctamente');
      setForm(emptyForm);
      await loadData(query);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar receptor');
    } finally {
      setSaving(false);
    }
  }

  if (authChecked && !canAccess) {
    return (
      <main className="min-h-screen bg-background p-4 text-foreground">
        <Card>
          <CardHeader>
            <CardTitle>Sin acceso</CardTitle>
            <CardDescription>
              Tu usuario no tiene acceso al modulo de receptores.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground">
      <div className="mx-auto w-full max-w-[96rem] space-y-4">
        <header className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-primary text-primary">
              Facturacion
            </p>
            <h1 className="mt-1 text-2xl font-bold">Receptores</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Administra clientes y datos fiscales reutilizables para armar DTE.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => loadData(query)}
            disabled={loading}
            className="h-11 rounded-xl"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            Actualizar
          </Button>
        </header>

        <Card className="rounded-xl border-border">
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary text-primary" />
              {form.id ? 'Editar receptor' : 'Nuevo receptor'}
            </CardTitle>
            <CardDescription>
              Guarda los campos comunes que luego se adaptan a consumidor final, credito fiscal, notas o sujeto excluido.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 pt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="tipoDocumento">Tipo documento</Label>
                  <SearchableSelect
                    id="tipoDocumento"
                    value={form.tipoDocumentoCodigo}
                    options={optionGroups.tiposDocumento}
                    onValueChange={(value) => setField('tipoDocumentoCodigo', value)}
                    placeholder="Tipo documento"
                    searchPlaceholder="Buscar documento"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numeroDocumento">Numero documento</Label>
                  <Input
                    id="numeroDocumento"
                    value={form.numeroDocumento}
                    onChange={(event) => setField('numeroDocumento', event.target.value)}
                    required
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="nombre">Nombre receptor</Label>
                  <Input
                    id="nombre"
                    value={form.nombre}
                    onChange={(event) => setField('nombre', event.target.value)}
                    required
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nrc">NRC</Label>
                  <Input
                    id="nrc"
                    value={form.nrc}
                    onChange={(event) => setField('nrc', event.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipoCliente">Tipo cliente</Label>
                  <SearchableSelect
                    id="tipoCliente"
                    value={form.tipoCliente}
                    options={tipoClienteOptions}
                    onValueChange={(value) => setField('tipoCliente', value)}
                    placeholder="Tipo cliente"
                    searchPlaceholder="Buscar tipo"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="actividad">Actividad</Label>
                  <SearchableSelect
                    id="actividad"
                    value={form.codigoActividad}
                    options={optionGroups.actividades}
                    onValueChange={(value) => setField('codigoActividad', value)}
                    placeholder="Seleccionar actividad"
                    searchPlaceholder="Buscar actividad"
                    clearable
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regimen">Regimen tributario</Label>
                  <SearchableSelect
                    id="regimen"
                    value={form.regimenTributarioCodigo}
                    options={optionGroups.regimenesTributarios}
                    onValueChange={(value) => setField('regimenTributarioCodigo', value)}
                    placeholder="Regimen"
                    searchPlaceholder="Buscar regimen"
                    clearable
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefono">Telefono</Label>
                  <Input
                    id="telefono"
                    value={form.telefono}
                    onChange={(event) => setField('telefono', event.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="correo">Correo</Label>
                  <Input
                    id="correo"
                    type="email"
                    value={form.correo}
                    onChange={(event) => setField('correo', event.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="departamento">Departamento</Label>
                  <SearchableSelect
                    id="departamento"
                    value={form.departamentoCodigo}
                    options={optionGroups.departamentos}
                    onValueChange={(value) => setField('departamentoCodigo', value)}
                    placeholder="Departamento"
                    searchPlaceholder="Buscar departamento"
                    clearable
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="municipio">Municipio</Label>
                  <SearchableSelect
                    id="municipio"
                    value={form.municipioCodigo}
                    options={optionGroups.municipios}
                    onValueChange={(value) => setField('municipioCodigo', value)}
                    placeholder={
                      form.departamentoCodigo
                        ? 'Municipio'
                        : 'Selecciona departamento'
                    }
                    searchPlaceholder="Buscar municipio"
                    disabled={!form.departamentoCodigo}
                    clearable
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="distrito">Distrito</Label>
                  <SearchableSelect
                    id="distrito"
                    value={form.distritoCodigo}
                    options={optionGroups.distritos}
                    onValueChange={(value) => setField('distritoCodigo', value)}
                    placeholder="Distrito"
                    searchPlaceholder="Buscar distrito"
                    clearable
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pais">Pais</Label>
                  <SearchableSelect
                    id="pais"
                    value={form.paisCodigo}
                    options={optionGroups.paises}
                    onValueChange={(value) => setField('paisCodigo', value)}
                    placeholder="Pais"
                    searchPlaceholder="Buscar pais"
                    clearable
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="usoPreferente">Uso preferente</Label>
                  <SearchableSelect
                    id="usoPreferente"
                    value={form.usoPreferente}
                    options={usoOptions}
                    onValueChange={(value) => setField('usoPreferente', value)}
                    placeholder="Uso"
                    searchPlaceholder="Buscar uso"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="direccion">Complemento direccion</Label>
                  <Input
                    id="direccion"
                    value={form.complementoDireccion}
                    onChange={(event) => setField('complementoDireccion', event.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.esConsumidorFinal}
                    onChange={(event) =>
                      setField('esConsumidorFinal', event.target.checked)
                    }
                    className="size-4 rounded border-border"
                  />
                  Marcar como consumidor final frecuente
                </label>

                <div className="flex gap-2">
                  {form.id && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setForm(emptyForm)}
                      className="h-11 rounded-xl"
                    >
                      Nuevo
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={saving}
                    className="h-11 rounded-xl bg-primary font-bold text-black hover:bg-primary/90"
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Guardar receptor
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {(error || success) && (
          <div
            className={
              error
                ? 'rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200'
                : 'rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200'
            }
          >
            {error || success}
          </div>
        )}

        <Card className="rounded-xl border-border">
          <CardHeader className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UsersRound className="size-5 text-primary text-primary" />
                  Tabla de receptores
                </CardTitle>
                <CardDescription>
                  {rows.length} receptores cargados para el emisor activo.
                </CardDescription>
              </div>

              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadData(query);
                }}
              >
                <div className="relative min-w-0 flex-1 sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar nombre, documento, NRC o correo"
                    className="h-11 rounded-xl pl-9"
                  />
                </div>
                <Button type="submit" variant="outline" className="h-11 rounded-xl">
                  Buscar
                </Button>
              </form>
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-0">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center">
                <Loader2 className="size-7 animate-spin text-primary text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receptor</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>NRC</TableHead>
                    <TableHead>Actividad</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Direccion</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Accion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        No hay receptores registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.nombre}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.tipoCliente || 'cliente'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{row.numeroDocumento}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.tipoDocumentoNombre || row.tipoDocumentoCodigo}
                          </div>
                        </TableCell>
                        <TableCell>{row.nrc || '-'}</TableCell>
                        <TableCell>
                          <div>{row.codigoActividad || '-'}</div>
                          <div className="max-w-56 truncate text-xs text-muted-foreground">
                            {row.actividadNombre || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{row.telefono || '-'}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.correo || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {[row.departamentoNombre, row.municipioNombre]
                              .filter(Boolean)
                              .join(' / ') || '-'}
                          </div>
                          <div className="max-w-64 truncate text-xs text-muted-foreground">
                            {row.complementoDireccion || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={row.datosCompletados ? 'default' : 'outline'}>
                              {row.datosCompletados ? 'Completo' : 'Pendiente'}
                            </Badge>
                            {row.esConsumidorFinal && (
                              <Badge variant="secondary">CF</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setForm(formFromReceptor(row))}
                          >
                            <Pencil className="size-4" />
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
