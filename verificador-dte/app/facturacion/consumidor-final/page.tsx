'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Download, Loader2, Plus, ReceiptText, Trash2 } from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/lib/firebase';
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
  uniMedida: 59,
  tipoItem: 2,
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

export default function FacturarConsumidorFinalPage() {
  const { appUser, authChecked } = useAuth();
  const [emitter, setEmitter] = useState<Emitter | null>(null);
  const [receptors, setReceptors] = useState<Receptor[]>([]);
  const [selectedReceptorId, setSelectedReceptorId] = useState('');
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

  const total = useMemo(
    () => items.reduce((sum, line) => sum + lineTotal(line), 0),
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
      if (transmitir && !passwordPri.trim()) {
        throw new Error('Ingresa la clave privada para firmar y transmitir.');
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
          items,
          passwordPri,
          transmitir,
          observaciones,
          environment: 'test',
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

  async function downloadJson() {
    if (!result?.finalPackage?.downloads?.json) return;
    try {
      const token = await firebaseToken();
      const res = await fetch(result.finalPackage.downloads.json, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No se pudo descargar el JSON');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.codigoGeneracion || result.id || 'factura-consumidor-final'}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el JSON');
    }
  }

  if (!authChecked) return null;

  if (!canUse) {
    return (
      <main className="min-h-[calc(100vh-5rem)] bg-slate-50 p-4 text-slate-950 dark:bg-black dark:text-white">
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
    <main className="min-h-[calc(100vh-5rem)] bg-slate-50 text-slate-950 dark:bg-black dark:text-white">
      <div className="grid w-full gap-4 p-0 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-yellow-300">
              Facturacion electronica
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Facturar consumidor final
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-zinc-300">
              Documento tipo 01. Se usa el emisor vinculado a tu cuenta, seleccionas un receptor y agregas los bienes o servicios facturados.
            </p>
          </div>

          {loading ? (
            <Card>
              <CardContent className="flex min-h-64 items-center justify-center">
                <Loader2 className="size-7 animate-spin text-amber-600 dark:text-yellow-300" />
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Emisor autenticado</CardTitle>
                  <CardDescription>Datos que se enviaran en el bloque oficial de emisor.</CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Receptor</CardTitle>
                  <CardDescription>Selecciona un cliente/receptor registrado para este emisor.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="receptor">Receptor</Label>
                    <select
                      id="receptor"
                      value={selectedReceptorId}
                      onChange={(event) => setSelectedReceptorId(event.target.value)}
                      className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Seleccionar receptor</option>
                      {receptors.map((receptor) => (
                        <option key={receptor.id} value={receptor.id}>
                          {receptor.nombre} - {receptor.numeroDocumento || 'sin documento'}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedReceptor && (
                    <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-3 dark:border-white/10 dark:bg-black">
                      <Info label="Nombre" value={selectedReceptor.nombre || '-'} />
                      <Info label="Documento" value={selectedReceptor.numeroDocumento || '-'} />
                      <Info label="Correo" value={selectedReceptor.correo || '-'} />
                    </div>
                  )}
                </CardContent>
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
                      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[8rem_minmax(0,1fr)_7rem_8rem_8rem_2.5rem] dark:border-white/10 dark:bg-black"
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Firma y envio</CardTitle>
                  <CardDescription>En ambiente test puedes generar solo el JSON o firmar y transmitir a Hacienda.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="passwordPri">Clave privada del certificado</Label>
                    <Input
                      id="passwordPri"
                      type="password"
                      value={passwordPri}
                      onChange={(event) => setPasswordPri(event.target.value)}
                      placeholder="Requerida para firmar"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-white/10 dark:bg-black">
                    <input
                      type="checkbox"
                      checked={transmitir}
                      onChange={(event) => setTransmitir(event.target.checked)}
                      className="size-4 accent-yellow-400"
                    />
                    <span>Transmitir a Hacienda test</span>
                  </label>
                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="observaciones">Observaciones</Label>
                    <Input
                      id="observaciones"
                      value={observaciones}
                      onChange={(event) => setObservaciones(event.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="size-5 text-amber-600 dark:text-yellow-300" />
                Resumen
              </CardTitle>
              <CardDescription>Factura consumidor final tipo 01.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                <p className="mt-1 text-3xl font-black">{money(total)}</p>
              </div>

              <Button
                type="button"
                disabled={loading || submitting}
                onClick={submitInvoice}
                className="h-12 w-full bg-yellow-400 font-bold text-black hover:bg-yellow-300"
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

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {processTiming && (
                <ProcessTimingCard timing={processTiming} transmitted={lastSubmittedTransmitir} />
              )}

              {result && (
                <div className="space-y-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Factura generada</p>
                      <p className="break-all font-mono text-xs">{result.codigoGeneracion}</p>
                    </div>
                  </div>
                  <div className="grid gap-1 text-xs">
                    <span>Control: {result.numeroControl || '-'}</span>
                    <span>Estado: {result.status || '-'}</span>
                    <span>Sello: {result.selloRecepcion || '-'}</span>
                  </div>
                  {(result.processTiming || result.finalPackage?.processTiming) && !processTiming && (
                    <ProcessTimingCard
                      timing={result.processTiming || result.finalPackage?.processTiming || {}}
                      transmitted={lastSubmittedTransmitir}
                    />
                  )}
                  {result.finalPackage?.downloads?.json && (
                    <Button type="button" variant="outline" className="w-full" onClick={downloadJson}>
                      <Download className="size-4" />
                      Descargar JSON
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
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
    <div className="rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-950">
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <Clock3 className="size-4 text-amber-600 dark:text-yellow-300" />
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

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'md:col-span-3' : ''}>
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}
