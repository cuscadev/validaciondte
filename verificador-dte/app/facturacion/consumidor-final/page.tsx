'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock3, Loader2, Plus, Search, Trash2, UserRoundSearch } from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/lib/firebase';
import { getHaciendaBrowserToken } from '@/lib/hacienda-token-storage';
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
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Emitter = {
  nit?: string;
  nrc?: string;
  nombre?: string;
  nombreComercial?: string;
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
  complementoDireccion?: string;
};

type InvoiceLine = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUni: number;
  montoDescu: number;
  ventaTipo: 'gravada' | 'exenta' | 'noSujeta' | 'noGravada';
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
  finalPackage?: {
    processTiming?: ProcessTiming;
    downloads?: {
      json?: string;
      pdf?: string;
    };
  };
  processTiming?: ProcessTiming;
  error?: string;
};

type ProcessTiming = {
  startedAt?: string;
  documentCreatedAt?: string;
  signedAt?: string;
  sentToHaciendaAt?: string;
  receivedFromHaciendaAt?: string;
  documentCreationMs?: number;
  signingMs?: number;
  haciendaMs?: number;
  totalMs?: number;
};

const emptyLine: InvoiceLine = {
  codigo: '',
  descripcion: '',
  cantidad: 1,
  precioUni: 0,
  montoDescu: 0,
  ventaTipo: 'gravada',
  uniMedida: 59,
  tipoItem: 2,
};

const receptorPageSize = 8;

type InvoiceSummary = {
  totalNoSuj: number;
  totalExenta: number;
  totalGravada: number;
  subTotalVentas: number;
  descuNoSuj: number;
  descuExenta: number;
  descuGravada: number;
  totalDescu: number;
  subTotal: number;
  ivaRete1: number;
  totalIva: number;
  montoTotalOperacion: number;
  totalNoGravado: number;
  totalPagar: number;
};

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

function formatTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-SV', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatDuration(ms?: number) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '-';
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 1 : 2)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes} min ${rest} s`;
}

function formatMilliseconds(ms?: number) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '-';
  return `${ms} ms`;
}

function lineTotal(line: InvoiceLine) {
  return Math.max(0, Number(line.cantidad || 0) * Number(line.precioUni || 0) - Number(line.montoDescu || 0));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function lineBase(line: InvoiceLine) {
  return Math.max(0, Number(line.cantidad || 0) * Number(line.precioUni || 0));
}

function buildLinePayload(line: InvoiceLine) {
  const net = roundMoney(lineTotal(line));
  return {
    ...line,
    ventaNoSuj: line.ventaTipo === 'noSujeta' ? net : 0,
    ventaExenta: line.ventaTipo === 'exenta' ? net : 0,
    ventaGravada: line.ventaTipo === 'gravada' ? net : 0,
    noGravado: line.ventaTipo === 'noGravada' ? net : 0,
  };
}

function buildSummary(items: InvoiceLine[]): InvoiceSummary {
  return items.reduce<InvoiceSummary>((summary, line) => {
    const payload = buildLinePayload(line);
    const discount = roundMoney(Math.min(Number(line.montoDescu || 0), lineBase(line)));
    summary.totalNoSuj = roundMoney(summary.totalNoSuj + payload.ventaNoSuj);
    summary.totalExenta = roundMoney(summary.totalExenta + payload.ventaExenta);
    summary.totalGravada = roundMoney(summary.totalGravada + payload.ventaGravada);
    summary.totalNoGravado = roundMoney(summary.totalNoGravado + payload.noGravado);
    summary.totalDescu = roundMoney(summary.totalDescu + discount);
    if (line.ventaTipo === 'noSujeta') summary.descuNoSuj = roundMoney(summary.descuNoSuj + discount);
    if (line.ventaTipo === 'exenta') summary.descuExenta = roundMoney(summary.descuExenta + discount);
    if (line.ventaTipo === 'gravada') summary.descuGravada = roundMoney(summary.descuGravada + discount);
    summary.totalIva = roundMoney(summary.totalIva + payload.ventaGravada * (13 / 113));
    summary.subTotalVentas = roundMoney(summary.totalNoSuj + summary.totalExenta + summary.totalGravada);
    summary.subTotal = summary.subTotalVentas;
    summary.montoTotalOperacion = roundMoney(summary.subTotalVentas + summary.totalNoGravado);
    summary.totalPagar = summary.montoTotalOperacion;
    return summary;
  }, {
    totalNoSuj: 0,
    totalExenta: 0,
    totalGravada: 0,
    subTotalVentas: 0,
    descuNoSuj: 0,
    descuExenta: 0,
    descuGravada: 0,
    totalDescu: 0,
    subTotal: 0,
    ivaRete1: 0,
    totalIva: 0,
    montoTotalOperacion: 0,
    totalNoGravado: 0,
    totalPagar: 0,
  });
}

export default function FacturarConsumidorFinalPage() {
  const { appUser, authChecked } = useAuth();
  const [emitter, setEmitter] = useState<Emitter | null>(null);
  const [receptors, setReceptors] = useState<Receptor[]>([]);
  const [selectedReceptorId, setSelectedReceptorId] = useState('');
  const [receptorModalOpen, setReceptorModalOpen] = useState(false);
  const [receptorSearch, setReceptorSearch] = useState('');
  const [receptorPage, setReceptorPage] = useState(1);
  const [items, setItems] = useState<InvoiceLine[]>([{ ...emptyLine }]);
  const [passwordPri, setPasswordPri] = useState('');
  const [transmitir, setTransmitir] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InvoiceResponse | null>(null);
  const [processTiming, setProcessTiming] = useState<ProcessTiming | null>(null);
  const [lastSubmittedTransmitir, setLastSubmittedTransmitir] = useState(false);
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
      ].map((value) => String(value || '').toLowerCase());
      const digitHaystack = [
        receptor.numeroDocumento,
        receptor.nrc,
      ].map((value) => String(value || '').replace(/\D/g, ''));
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

  const summary = useMemo(
    () => buildSummary(items),
    [items]
  );

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
        if (!receptorsRes.ok) throw new Error(receptorsPayload.error || 'No se pudieron cargar receptores');

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

  function updateLine(index: number, patch: Partial<InvoiceLine>) {
    setItems((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
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
    setProcessTiming(null);
    setLastSubmittedTransmitir(transmitir);

    try {
      if (!selectedReceptorId) throw new Error('Selecciona un receptor.');
      if (items.some((line) => !line.descripcion.trim())) {
        throw new Error('Cada item debe tener descripcion.');
      }
      if (items.some((line) => line.cantidad <= 0 || line.precioUni <= 0)) {
        throw new Error('Cada item debe tener cantidad y precio mayor a cero.');
      }
      const token = await firebaseToken();
      const res = await fetch('/api/facturacion/consumer-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receptorId: Number(selectedReceptorId),
          items: items.map(buildLinePayload),
          passwordPri,
          transmitir,
          observaciones,
          environment: 'test',
          haciendaToken: transmitir ? getHaciendaBrowserToken('test') : undefined,
        }),
      });

      const payload = (await res.json()) as InvoiceResponse;
      setProcessTiming(payload.processTiming || payload.finalPackage?.processTiming || null);
      if (!res.ok) throw new Error(payload.error || 'No se pudo facturar');
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo facturar');
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
            <h1 className="text-3xl font-extrabold tracking-tight">
              Facturar consumidor final
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Documento tipo 01. Se usa el emisor vinculado a tu cuenta, seleccionas un receptor y agregas los bienes o servicios facturados.
            </p>
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
                        <CardDescription>Datos oficiales del emisor y receptor del DTE.</CardDescription>
                      </div>
                      <TabsList className="grid w-full grid-cols-2 sm:w-72">
                        <TabsTrigger value="emisor">Emisor</TabsTrigger>
                        <TabsTrigger value="receptor">Receptor</TabsTrigger>
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
                          <Label>Receptor</Label>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-auto min-h-11 justify-start gap-3 px-3 py-2 text-left"
                            onClick={() => setReceptorModalOpen(true)}
                          >
                            <UserRoundSearch className="size-5 shrink-0 text-primary text-primary" />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                {selectedReceptor?.nombre || 'Seleccionar receptor'}
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
                            <Info label="NRC" value={selectedReceptor.nrc || '-'} />
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
                      <CardTitle>Items facturados</CardTitle>
                      <CardDescription>Descripcion, cantidad, unidad de medida 59 por defecto y precio unitario.</CardDescription>
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
                      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[7rem_minmax(0,1fr)_6rem_7rem_7rem_8rem_8rem_2.5rem] border-border bg-background"
                    >
                      <div className="grid gap-1">
                        <Label htmlFor={`codigo-${index}`}>Codigo</Label>
                        <Input
                          id={`codigo-${index}`}
                          value={line.codigo}
                          onChange={(event) => updateLine(index, { codigo: event.target.value })}
                          placeholder="SERV-001"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor={`desc-${index}`}>Descripcion</Label>
                        <Input
                          id={`desc-${index}`}
                          value={line.descripcion}
                          onChange={(event) => updateLine(index, { descripcion: event.target.value })}
                          placeholder="Servicio o producto"
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
                        <Label htmlFor={`venta-tipo-${index}`}>Tipo venta</Label>
                        <select
                          id={`venta-tipo-${index}`}
                          value={line.ventaTipo}
                          onChange={(event) => updateLine(index, { ventaTipo: event.target.value as InvoiceLine['ventaTipo'] })}
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="gravada">Gravada</option>
                          <option value="exenta">Exenta</option>
                          <option value="noSujeta">No sujeta</option>
                          <option value="noGravada">No gravada</option>
                        </select>
                      </div>
                      <div className="grid gap-1">
                        <Label>Total</Label>
                        <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm font-semibold">
                          {money(lineTotal(line))}
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
                  <div className="pt-3">
                    <div className="mb-2 text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Resumen del documento
                    </div>
                    <div className="ml-auto w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 text-sm border-border">
                      <SummaryRow label="Suma de Ventas" value={`${money(summary.totalNoSuj)} / ${money(summary.totalExenta)} / ${money(summary.totalGravada)}`} />
                      <SummaryRow label="Sumatoria de ventas" value={money(summary.subTotalVentas)} />
                      <SummaryRow label="Descuento global a ventas no sujetas" value={money(summary.descuNoSuj)} />
                      <SummaryRow label="Descuento global a ventas exentas" value={money(summary.descuExenta)} />
                      <SummaryRow label="Descuento global a ventas gravadas" value={money(summary.descuGravada)} />
                      <SummaryRow label="Nombre del Tributo" value="IVA" />
                      <SummaryRow label="Valor del Tributo" value={money(summary.totalIva)} />
                      <SummaryRow label="Sub-Total" value={money(summary.subTotal)} />
                      <SummaryRow label="IVA Retenido" value={money(summary.ivaRete1)} />
                      <SummaryRow label="Monto Total de la Operacion" value={money(summary.montoTotalOperacion)} />
                      <SummaryRow label="Total Otros Montos No Afectos" value={money(summary.totalNoGravado)} />
                      <SummaryRow label="Total a Pagar" value={money(summary.totalPagar)} strong />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm border-border bg-card">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
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
                  </div>
                  <Button
                    type="button"
                    disabled={loading || submitting}
                    onClick={submitInvoice}
                    className="h-11 bg-primary font-bold text-black hover:bg-primary/90 lg:min-w-48"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Procesando
                      </>
                    ) : (
                      'Generar factura'
                    )}
                  </Button>
                </div>
                {error && (
                  <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                    {error}
                  </p>
                )}
                {result && (
                  <p className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
                    Factura generada: <span className="font-mono">{result.codigoGeneracion}</span>
                  </p>
                )}
              </div>
            </>
          )}
        </section>

      </div>
      <Modal open={receptorModalOpen} onClose={() => setReceptorModalOpen(false)} className="w-full max-w-5xl">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Seleccionar receptor</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Busca por nombre, DUI, NIT, numero de documento o NRC.
              </p>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={receptorSearch}
                onChange={(event) => setReceptorSearch(event.target.value)}
                placeholder="Buscar receptor"
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Nombre</th>
                  <th className="px-3 py-3">DUI / NIT</th>
                  <th className="px-3 py-3">NRC</th>
                  <th className="px-3 py-3">Correo</th>
                  <th className="px-3 py-3">Telefono</th>
                  <th className="px-3 py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody>
                {pagedReceptors.map((receptor) => (
                  <tr key={receptor.id} className="border-b border-slate-200 last:border-0 border-border">
                    <td className="px-3 py-3 font-semibold">{receptor.nombre || '-'}</td>
                    <td className="px-3 py-3 font-mono text-xs">{receptor.numeroDocumento || '-'}</td>
                    <td className="px-3 py-3 font-mono text-xs">{receptor.nrc || '-'}</td>
                    <td className="px-3 py-3">{receptor.correo || '-'}</td>
                    <td className="px-3 py-3">{receptor.telefono || '-'}</td>
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
                      No se encontraron receptores.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {filteredReceptors.length} receptores · Pagina {Math.min(receptorPage, receptorTotalPages)} de {receptorTotalPages}
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

function ProcessTimingCard({
  timing,
  transmitted,
}: {
  timing: ProcessTiming;
  transmitted: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-sm border-border bg-card">
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <Clock3 className="size-4 text-primary text-primary" />
        Tiempos de emision
      </div>
      <div className="grid gap-2 text-xs">
        <TimingRow label="Inicio" value={formatTime(timing.startedAt)} />
        <TimingRow
          label="Documento"
          value={`${formatTime(timing.documentCreatedAt)} · ${formatDuration(timing.documentCreationMs)}`}
        />
        <TimingRow
          label="Firma"
          value={`${formatTime(timing.signedAt)} · ${formatMilliseconds(timing.signingMs)}`}
        />
        <TimingRow
          label="Envio Hacienda"
          value={transmitted ? formatTime(timing.sentToHaciendaAt) : 'No transmitido'}
        />
        <TimingRow
          label="Respuesta"
          value={
            transmitted
              ? `${formatTime(timing.receivedFromHaciendaAt)} · ${formatDuration(timing.haciendaMs)}`
              : 'No transmitido'
          }
        />
        <TimingRow label="Total" value={formatDuration(timing.totalMs)} strong />
      </div>
    </div>
  );
}

function TimingRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${strong ? 'font-semibold' : 'font-medium'}`}>{value}</span>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] border-b border-slate-200 last:border-0 border-border">
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
