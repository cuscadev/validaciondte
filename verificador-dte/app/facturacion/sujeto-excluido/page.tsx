'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search, Trash2, UserRoundSearch } from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/lib/firebase';
import { getHaciendaBrowserToken } from '@/lib/hacienda-token-storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Emitter = {
  nit?: string;
  nrc?: string;
  nombre?: string;
  codigoActividad?: string;
  descripcionActividad?: string;
  departamentoCodigo?: string;
  municipioCodigo?: string;
  distritoCodigo?: string;
  complementoDireccion?: string;
  telefono?: string;
  correo?: string;
};

type Receptor = {
  id: number;
  nombre?: string;
  numeroDocumento?: string;
  tipoDocumentoCodigo?: string;
  nrc?: string;
  correo?: string;
  telefono?: string;
  departamentoCodigo?: string;
  municipioCodigo?: string;
  distritoCodigo?: string;
  complementoDireccion?: string;
  codigoActividad?: string;
  actividadNombre?: string;
};

type ExcludedLine = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUni: number;
  montoDescu: number;
  uniMedida: number;
  tipoItem: number;
};

type InvoiceResponse = {
  success?: boolean;
  id?: string;
  status?: string;
  codigoGeneracion?: string;
  numeroControl?: string;
  totalPagar?: number;
  selloRecepcion?: string;
  error?: string;
};

type Summary = {
  totalCompra: number;
  totalDescu: number;
  subTotal: number;
  reteRenta: number;
  totalPagar: number;
};

const emptyLine: ExcludedLine = {
  codigo: '',
  descripcion: '',
  cantidad: 1,
  precioUni: 0,
  montoDescu: 0,
  uniMedida: 59,
  tipoItem: 2,
};

const receptorPageSize = 8;

async function firebaseToken() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sesion no autorizada');
  return token;
}

function money(value: number) {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function lineBase(line: ExcludedLine) {
  return roundMoney(Math.max(0, Number(line.cantidad || 0) * Number(line.precioUni || 0)));
}

function lineCompra(line: ExcludedLine) {
  return roundMoney(Math.max(0, lineBase(line) - Number(line.montoDescu || 0)));
}

function buildLinePayload(line: ExcludedLine) {
  return {
    ...line,
    compra: lineCompra(line),
  };
}

function buildSummary(items: ExcludedLine[], reteRenta: number): Summary {
  const totalCompra = roundMoney(items.reduce((total, line) => total + lineCompra(line), 0));
  const totalDescu = roundMoney(items.reduce((total, line) => total + Math.min(Number(line.montoDescu || 0), lineBase(line)), 0));
  const renta = roundMoney(Math.max(0, reteRenta || 0));
  return {
    totalCompra,
    totalDescu,
    subTotal: totalCompra,
    reteRenta: renta,
    totalPagar: roundMoney(Math.max(0, totalCompra - renta)),
  };
}

export default function FacturarSujetoExcluidoPage() {
  const { appUser, authChecked } = useAuth();
  const [emitter, setEmitter] = useState<Emitter | null>(null);
  const [receptors, setReceptors] = useState<Receptor[]>([]);
  const [selectedReceptorId, setSelectedReceptorId] = useState('');
  const [receptorModalOpen, setReceptorModalOpen] = useState(false);
  const [receptorSearch, setReceptorSearch] = useState('');
  const [receptorPage, setReceptorPage] = useState(1);
  const [items, setItems] = useState<ExcludedLine[]>([{ ...emptyLine }]);
  const [transmitir, setTransmitir] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [reteRenta, setReteRenta] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InvoiceResponse | null>(null);
  const [error, setError] = useState('');

  const canUse = appUser?.role === 'cliente' || appUser?.role === 'superadmin';
  const selectedReceptor = useMemo(
    () => receptors.find((r) => String(r.id) === selectedReceptorId),
    [receptors, selectedReceptorId]
  );

  const filteredReceptors = useMemo(() => {
    const query = receptorSearch.trim().toLowerCase();
    if (!query) return receptors;
    const onlyDigits = query.replace(/\D/g, '');
    return receptors.filter((receptor) => {
      const haystack = [
        receptor.nombre,
        receptor.numeroDocumento,
        receptor.nrc,
        receptor.tipoDocumentoCodigo,
        receptor.actividadNombre,
      ].map((value) => String(value || '').toLowerCase());
      const digitHaystack = [receptor.numeroDocumento, receptor.nrc]
        .map((value) => String(value || '').replace(/\D/g, ''));
      return haystack.some((value) => value.includes(query)) ||
        Boolean(onlyDigits && digitHaystack.some((value) => value.includes(onlyDigits)));
    });
  }, [receptorSearch, receptors]);

  const receptorTotalPages = Math.max(1, Math.ceil(filteredReceptors.length / receptorPageSize));
  const pagedReceptors = useMemo(() => {
    const safePage = Math.min(receptorPage, receptorTotalPages);
    const start = (safePage - 1) * receptorPageSize;
    return filteredReceptors.slice(start, start + receptorPageSize);
  }, [filteredReceptors, receptorPage, receptorTotalPages]);

  const summary = useMemo(() => buildSummary(items, reteRenta), [items, reteRenta]);

  useEffect(() => {
    if (!authChecked || !canUse) return;
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const token = await firebaseToken();
        const [emitterRes, receptorsRes] = await Promise.all([
          fetch('/api/profile/emisor', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/facturacion/receptors', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const emitterPayload = await emitterRes.json().catch(() => ({}));
        const receptorsPayload = await receptorsRes.json().catch(() => ({}));

        if (!emitterRes.ok) throw new Error(emitterPayload.error || 'No se pudo cargar el emisor');
        if (!receptorsRes.ok) throw new Error(receptorsPayload.error || 'No se pudieron cargar sujetos excluidos');

        if (!cancelled) {
          setEmitter(emitterPayload.emitter || null);
          setReceptors(receptorsPayload.receptors || []);
          const first = receptorsPayload.receptors?.[0];
          if (first?.id) setSelectedReceptorId(String(first.id));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando facturacion');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [authChecked, canUse]);

  useEffect(() => {
    setReceptorPage(1);
  }, [receptorSearch]);

  useEffect(() => {
    if (receptorPage > receptorTotalPages) setReceptorPage(receptorTotalPages);
  }, [receptorPage, receptorTotalPages]);

  function updateLine(index: number, patch: Partial<ExcludedLine>) {
    setItems((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setItems((current) => [...current, { ...emptyLine }]);
  }

  function removeLine(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  function selectReceptor(receptor: Receptor) {
    setSelectedReceptorId(String(receptor.id));
    setReceptorModalOpen(false);
  }

  async function submitInvoice() {
    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      if (!selectedReceptorId) throw new Error('Selecciona el sujeto excluido.');
      if (items.some((line) => !line.descripcion.trim())) throw new Error('Cada item debe tener descripcion.');
      if (items.some((line) => line.cantidad <= 0 || line.precioUni <= 0)) {
        throw new Error('Cada item debe tener cantidad y precio mayor a cero.');
      }
      const token = await firebaseToken();
      const res = await fetch('/api/facturacion/excluded-subject-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receptorId: Number(selectedReceptorId),
          items: items.map(buildLinePayload),
          transmitir,
          observaciones,
          reteRenta,
          environment: 'test',
          haciendaToken: transmitir ? getHaciendaBrowserToken('test') : undefined,
        }),
      });

      const payload = (await res.json()) as InvoiceResponse;
      if (!res.ok) throw new Error(payload.error || 'No se pudo emitir sujeto excluido');
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo emitir sujeto excluido');
    } finally {
      setSubmitting(false);
    }
  }

  if (!authChecked) return null;

  if (!canUse) {
    return (
      <main className="min-h-[calc(100vh-5rem)] bg-slate-50 p-4 text-slate-950 bg-background text-foreground">
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle>Acceso restringido</CardTitle>
            <CardDescription>Este modulo esta disponible para clientes y superadmin.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-background text-foreground">
      <div className="w-full p-0">
        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-primary text-primary">
              Facturacion electronica
            </p>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">Facturar sujeto excluido</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Documento tipo 14 para compras a personas o proveedores excluidos de la calidad de contribuyente.
                </p>
              </div>
              <Button
                type="button"
                disabled={loading || submitting}
                onClick={submitInvoice}
                className="h-11 bg-primary font-bold text-black hover:bg-primary/90 lg:min-w-52"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Procesando
                  </>
                ) : (
                  'Firma y envio'
                )}
              </Button>
            </div>
          </div>

          {loading ? (
            <Card>
              <CardContent className="flex min-h-64 items-center justify-center">
                <Loader2 className="size-7 animate-spin text-primary text-primary" />
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <Tabs defaultValue="emisor">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>Partes del documento</CardTitle>
                        <CardDescription>Datos oficiales del emisor y del sujeto excluido.</CardDescription>
                      </div>
                      <TabsList className="grid w-full grid-cols-2 sm:w-72">
                        <TabsTrigger value="emisor">Emisor</TabsTrigger>
                        <TabsTrigger value="receptor">Sujeto excluido</TabsTrigger>
                      </TabsList>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <TabsContent value="emisor" className="mt-0">
                      {emitter ? (
                        <div className="grid gap-3 text-sm md:grid-cols-3">
                          <Info label="Nombre" value={emitter.nombre || '-'} />
                          <Info label="NIT / NRC" value={`${emitter.nit || '-'} / ${emitter.nrc || '-'}`} />
                          <Info label="Actividad" value={emitter.descripcionActividad || emitter.codigoActividad || '-'} />
                          <Info label="Direccion" value={emitter.complementoDireccion || '-'} wide />
                          <Info label="Telefono" value={emitter.telefono || '-'} />
                          <Info label="Correo" value={emitter.correo || '-'} />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No hay emisor configurado.</p>
                      )}
                    </TabsContent>
                    <TabsContent value="receptor" className="mt-0">
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label>Sujeto excluido</Label>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-auto min-h-11 justify-start gap-3 px-3 py-2 text-left"
                            onClick={() => setReceptorModalOpen(true)}
                          >
                            <UserRoundSearch className="size-5 shrink-0 text-primary text-primary" />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                {selectedReceptor?.nombre || 'Seleccionar sujeto excluido'}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {selectedReceptor
                                  ? `${selectedReceptor.numeroDocumento || 'sin documento'}${selectedReceptor.nrc ? ` - NRC ${selectedReceptor.nrc}` : ''}`
                                  : 'Buscar por nombre, DUI, NIT o NRC'}
                              </span>
                            </span>
                          </Button>
                        </div>
                        {selectedReceptor && (
                          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-3 border-border bg-background">
                            <Info label="Nombre" value={selectedReceptor.nombre || '-'} />
                            <Info label="Documento" value={selectedReceptor.numeroDocumento || '-'} />
                            <Info label="Actividad" value={selectedReceptor.actividadNombre || selectedReceptor.codigoActividad || '-'} />
                            <Info label="Correo" value={selectedReceptor.correo || '-'} />
                            <Info label="Telefono" value={selectedReceptor.telefono || '-'} />
                            <Info label="Direccion" value={selectedReceptor.complementoDireccion || '-'} />
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>Compras</CardTitle>
                      <CardDescription>Cuerpo del documento sujeto excluido: cantidad, precio, descuento y compra.</CardDescription>
                    </div>
                    <Button type="button" variant="outline" onClick={addLine}>
                      <Plus className="size-4" />
                      Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((line, index) => (
                    <div
                      key={index}
                      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[7rem_minmax(0,1fr)_6rem_7rem_7rem_8rem_2.5rem] border-border bg-background"
                    >
                      <div className="grid gap-1">
                        <Label htmlFor={`codigo-${index}`}>Codigo</Label>
                        <Input
                          id={`codigo-${index}`}
                          value={line.codigo}
                          onChange={(event) => updateLine(index, { codigo: event.target.value })}
                          placeholder="COMP-001"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor={`desc-${index}`}>Descripcion</Label>
                        <Input
                          id={`desc-${index}`}
                          value={line.descripcion}
                          onChange={(event) => updateLine(index, { descripcion: event.target.value })}
                          placeholder="Bien o servicio adquirido"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor={`cantidad-${index}`}>Cantidad</Label>
                        <Input
                          id={`cantidad-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.cantidad}
                          onChange={(event) => updateLine(index, { cantidad: Number(event.target.value) })}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor={`precio-${index}`}>Precio</Label>
                        <Input
                          id={`precio-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.precioUni}
                          onChange={(event) => updateLine(index, { precioUni: Number(event.target.value) })}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor={`descuento-${index}`}>Descuento</Label>
                        <Input
                          id={`descuento-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.montoDescu}
                          onChange={(event) => updateLine(index, { montoDescu: Number(event.target.value) })}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label>Compra</Label>
                        <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm font-semibold">
                          {money(lineCompra(line))}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="self-end"
                        disabled={items.length === 1}
                        onClick={() => removeLine(index)}
                        aria-label="Eliminar item"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="grid gap-3 pt-3 lg:grid-cols-[minmax(0,1fr)_28rem]">
                    <div className="grid gap-3 md:grid-cols-[16rem_minmax(0,1fr)]">
                      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm border-border bg-background">
                        <input
                          type="checkbox"
                          checked={transmitir}
                          onChange={(event) => setTransmitir(event.target.checked)}
                          className="size-4 accent-primary"
                        />
                        <span>Transmitir a Hacienda test</span>
                      </label>
                      <div className="grid gap-2">
                        <Label htmlFor="observaciones">Observaciones</Label>
                        <Input
                          id="observaciones"
                          value={observaciones}
                          onChange={(event) => setObservaciones(event.target.value)}
                          placeholder="Opcional"
                        />
                      </div>
                      <div className="grid gap-2 md:col-span-2">
                        <Label htmlFor="rete-renta">Retencion renta</Label>
                        <Input
                          id="rete-renta"
                          type="number"
                          min="0"
                          step="0.01"
                          value={reteRenta}
                          onChange={(event) => setReteRenta(Number(event.target.value))}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Resumen del documento
                      </div>
                      <div className="overflow-hidden rounded-lg border border-slate-200 text-sm border-border">
                        <SummaryRow label="Total compra" value={money(summary.totalCompra)} />
                        <SummaryRow label="Descuento" value={money(0)} />
                        <SummaryRow label="Total descuento" value={money(summary.totalDescu)} />
                        <SummaryRow label="Sub-Total" value={money(summary.subTotal)} />
                        <SummaryRow label="Retencion renta" value={money(summary.reteRenta)} />
                        <SummaryRow label="Total a Pagar" value={money(summary.totalPagar)} strong />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {error && (
                <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                  {error}
                </p>
              )}
              {result && (
                <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
                  Sujeto excluido generado: <span className="font-mono">{result.codigoGeneracion}</span>
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <Modal open={receptorModalOpen} onClose={() => setReceptorModalOpen(false)} className="w-full max-w-5xl">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Seleccionar sujeto excluido</h2>
              <p className="mt-1 text-sm text-muted-foreground">Busca por nombre, DUI, NIT, documento o NRC.</p>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={receptorSearch}
                onChange={(event) => setReceptorSearch(event.target.value)}
                placeholder="Buscar sujeto excluido"
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground border-border bg-background">
                <tr>
                  <th className="px-3 py-3">Nombre</th>
                  <th className="px-3 py-3">Documento</th>
                  <th className="px-3 py-3">NRC</th>
                  <th className="px-3 py-3">Actividad</th>
                  <th className="px-3 py-3">Direccion</th>
                  <th className="px-3 py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody>
                {pagedReceptors.map((receptor) => (
                  <tr key={receptor.id} className="border-b border-slate-200 last:border-0 border-border">
                    <td className="px-3 py-3 font-semibold">{receptor.nombre || '-'}</td>
                    <td className="px-3 py-3 font-mono text-xs">{receptor.numeroDocumento || '-'}</td>
                    <td className="px-3 py-3 font-mono text-xs">{receptor.nrc || '-'}</td>
                    <td className="px-3 py-3">{receptor.actividadNombre || receptor.codigoActividad || '-'}</td>
                    <td className="px-3 py-3">{receptor.complementoDireccion || '-'}</td>
                    <td className="px-3 py-3 text-right">
                      <Button type="button" size="sm" onClick={() => selectReceptor(receptor)}>
                        Seleccionar
                      </Button>
                    </td>
                  </tr>
                ))}
                {!pagedReceptors.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      No se encontraron sujetos excluidos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {filteredReceptors.length} sujetos excluidos - Pagina {Math.min(receptorPage, receptorTotalPages)} de {receptorTotalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={receptorPage <= 1}
                onClick={() => setReceptorPage((page) => Math.max(1, page - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={receptorPage >= receptorTotalPages}
                onClick={() => setReceptorPage((page) => Math.min(receptorTotalPages, page + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </main>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_9rem] border-b border-slate-200 last:border-0 border-border">
      <div className={`bg-white px-3 py-2 text-right bg-card ${strong ? 'font-bold' : 'font-semibold'}`}>
        {label}
      </div>
      <div className={`bg-slate-50 px-3 py-2 text-right bg-background ${strong ? 'font-bold' : 'font-medium'}`}>
        {value}
      </div>
    </div>
  );
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'md:col-span-3' : ''}>
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}
