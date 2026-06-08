'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Loader2, PackageCheck, Play, ReceiptText, RefreshCw } from 'lucide-react';

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

type Emitter = {
  nit?: string;
  nrc?: string;
  nombre?: string;
  codigoActividad?: string;
  descripcionActividad?: string;
  complementoDireccion?: string;
};

type Receptor = {
  id: number;
  nombre?: string;
  numeroDocumento?: string;
  correo?: string;
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

type ProcessTiming = {
  signingMs?: number;
  haciendaMs?: number;
  totalMs?: number;
};

type InvoiceResponse = {
  success?: boolean;
  id?: string;
  status?: string;
  codigoLote?: string;
  codigosLote?: string[];
  rows?: BatchResponseRow[];
  chunks?: BatchChunk[];
  timing?: ProcessTiming;
  error?: string;
};

type BatchResponseRow = {
  index: number;
  chunk?: number;
  codigoGeneracion?: string;
  numeroControl?: string;
  signSuccess?: boolean;
  signError?: string;
  version?: number;
  codigoLote?: string;
};

type BatchChunk = {
  index: number;
  size: number;
  codigoLote?: string;
  signingMs?: number;
  haciendaMs?: number;
  totalMs?: number;
};

type BatchRow = {
  index: number;
  chunk?: number;
  status: 'pending' | 'running' | 'ok' | 'error';
  codigoGeneracion?: string;
  numeroControl?: string;
  selloRecepcion?: string;
  error?: string;
  codigoLote?: string;
  timing?: ProcessTiming;
  elapsedMs?: number;
};

type SavedLote = {
  id: string;
  status?: string;
  environment?: 'test' | 'production';
  batchSize?: number;
  chunkSize?: number;
  codigoLote?: string;
  codigosLote?: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
  lastConsultedAt?: string | null;
  lastConsultaStatus?: string;
  lastConsultaCodigoLote?: string;
  lastConsultaResponse?: LoteConsultaResponse | null;
};

type LoteConsultaItem = {
  estado?: string;
  codigoLote?: string;
  codigoGeneracion?: string;
  selloRecibido?: string | null;
  fhProcesamiento?: string;
  codigoMsg?: string;
  descripcionMsg?: string;
  observaciones?: unknown[];
};

type LoteConsultaResponse = {
  procesados?: LoteConsultaItem[];
  rechazados?: LoteConsultaItem[];
  estado?: string;
  codigoLote?: string;
  codigoMsg?: string;
  descripcionMsg?: string;
  observaciones?: unknown[];
  error?: string;
};

const emptyLine: InvoiceLine = {
  codigo: 'SERV-LOTE',
  descripcion: 'Servicio de prueba por lote',
  cantidad: 1,
  precioUni: 1,
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

function formatMs(ms?: number) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '-';
  return `${ms} ms`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function loteRows(payload?: LoteConsultaResponse | null) {
  const procesados = (payload?.procesados || []).map((item) => ({ ...item, estado: item.estado || 'PROCESADO' }));
  const rechazados = (payload?.rechazados || []).map((item) => ({ ...item, estado: item.estado || 'RECHAZADO' }));
  if (procesados.length || rechazados.length) return [...procesados, ...rechazados];
  if (payload?.estado || payload?.codigoMsg || payload?.descripcionMsg) return [payload];
  return [];
}

function lineTotal(line: InvoiceLine) {
  return Math.max(0, Number(line.cantidad || 0) * Number(line.precioUni || 0) - Number(line.montoDescu || 0));
}

export default function EnvioLotesPage() {
  const { appUser, authChecked } = useAuth();
  const [emitter, setEmitter] = useState<Emitter | null>(null);
  const [receptors, setReceptors] = useState<Receptor[]>([]);
  const [selectedReceptorId, setSelectedReceptorId] = useState('');
  const [line, setLine] = useState<InvoiceLine>({ ...emptyLine });
  const [batchSize, setBatchSize] = useState(100);
  const [chunkSize, setChunkSize] = useState(100);
  const [passwordPri, setPasswordPri] = useState('');
  const [transmitir, setTransmitir] = useState(true);
  const [observaciones, setObservaciones] = useState('Prueba de emision por lote');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [batchElapsedMs, setBatchElapsedMs] = useState<number | null>(null);
  const [codigoLote, setCodigoLote] = useState('');
  const [chunks, setChunks] = useState<BatchChunk[]>([]);
  const [error, setError] = useState('');
  const [savedLotes, setSavedLotes] = useState<SavedLote[]>([]);
  const [loadingSavedLotes, setLoadingSavedLotes] = useState(false);
  const [consultingLoteId, setConsultingLoteId] = useState('');
  const [consultaResults, setConsultaResults] = useState<Record<string, LoteConsultaResponse>>({});

  const canUse = appUser?.role === 'cliente' || appUser?.role === 'superadmin';
  const total = useMemo(() => lineTotal(line), [line]);
  const completed = rows.filter((row) => row.status === 'ok' || row.status === 'error').length;
  const successful = rows.filter((row) => row.status === 'ok').length;

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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando envio de lotes');
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
    if (!authChecked || !canUse) return;
    void loadSavedLotes();
  }, [authChecked, canUse]);

  async function loadSavedLotes() {
    setLoadingSavedLotes(true);
    try {
      const token = await firebaseToken();
      const res = await fetch('/api/facturacion/lotes?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => ({})) as { lotes?: SavedLote[]; error?: string };
      if (!res.ok) throw new Error(payload.error || 'No se pudieron cargar lotes guardados');
      setSavedLotes(payload.lotes || []);
      setConsultaResults((current) => {
        const next = { ...current };
        for (const lote of payload.lotes || []) {
          if (lote.lastConsultaResponse) next[lote.id] = lote.lastConsultaResponse;
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar lotes guardados');
    } finally {
      setLoadingSavedLotes(false);
    }
  }

  async function consultSavedLote(lote: SavedLote, codigo: string) {
    setConsultingLoteId(`${lote.id}:${codigo}`);
    setError('');
    try {
      const token = await firebaseToken();
      const res = await fetch(`/api/facturacion/lotes/${encodeURIComponent(lote.id)}/consultar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          codigoLote: codigo,
          environment: lote.environment || 'test',
        }),
      });
      const payload = await res.json().catch(() => ({})) as {
        response?: LoteConsultaResponse;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || 'No se pudo consultar el lote');
      setConsultaResults((current) => ({ ...current, [lote.id]: payload.response || {} }));
      await loadSavedLotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo consultar el lote');
    } finally {
      setConsultingLoteId('');
    }
  }

  function updateLine(patch: Partial<InvoiceLine>) {
    setLine((current) => ({ ...current, ...patch }));
  }

  async function submitBatch() {
    setSubmitting(true);
    setError('');
    setBatchElapsedMs(null);
    setCodigoLote('');
    setChunks([]);
    const batchStartedAt = Date.now();
    const count = Math.max(1, Math.min(1000, Math.floor(Number(batchSize || 1))));
    const chunkMin = transmitir ? 2 : 1;
    const chunkMax = transmitir ? Math.min(count, 100) : count;
    const docsPerChunk = Math.max(chunkMin, Math.min(chunkMax, Math.floor(Number(chunkSize || chunkMax))));
    const initialRows = Array.from({ length: count }, (_, index) => ({
      index: index + 1,
      status: 'pending' as const,
    }));
    setRows(initialRows);

    try {
      if (!selectedReceptorId) throw new Error('Selecciona un receptor.');
      if (!line.descripcion.trim()) throw new Error('La descripcion del item es requerida.');
      if (line.cantidad <= 0 || line.precioUni <= 0) {
        throw new Error('Cantidad y precio deben ser mayores a cero.');
      }
      if (transmitir && !passwordPri.trim()) {
        throw new Error('Ingresa la clave privada para firmar y transmitir.');
      }
      if (transmitir && count < 2) {
        throw new Error('El envio por lote requiere al menos 2 documentos.');
      }

      const token = await firebaseToken();
      setRows((current) => current.map((row) => ({ ...row, status: 'running' })));

      const res = await fetch('/api/facturacion/consumer-invoice-batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receptorId: Number(selectedReceptorId),
          items: [line],
          batchSize: count,
          chunkSize: docsPerChunk,
          passwordPri,
          transmitir,
          observaciones,
          environment: 'test',
          haciendaToken: transmitir ? getHaciendaBrowserToken('test') : undefined,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as InvoiceResponse;
      const timing = payload.timing;
      setCodigoLote(payload.codigoLote || '');
      setChunks(payload.chunks || []);
      const responseRows = payload.rows || [];
      setRows((current) =>
        current.map((row) => {
          const responseRow = responseRows.find((item) => item.index === row.index);
          return {
            ...row,
            status: res.ok && responseRow?.signSuccess !== false ? 'ok' : 'error',
            chunk: responseRow?.chunk,
            codigoGeneracion: responseRow?.codigoGeneracion,
            numeroControl: responseRow?.numeroControl,
            error: responseRow?.signError || (!res.ok ? payload.error || 'No se pudo emitir lote' : undefined),
            codigoLote: responseRow?.codigoLote,
            timing,
            elapsedMs: timing?.totalMs,
          };
        })
      );

      if (!res.ok) throw new Error(payload.error || 'No se pudo emitir lote');
      if (payload.codigoLote || payload.codigosLote?.length) {
        await loadSavedLotes();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ejecutar el lote');
    } finally {
      setBatchElapsedMs(Date.now() - batchStartedAt);
      setSubmitting(false);
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
            <h1 className="text-3xl font-extrabold tracking-tight">Envio de lotes</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-zinc-300">
              Genera varias facturas de consumidor final de prueba con el mismo contenido. Cada envio crea un codigo de generacion distinto.
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
                  <CardTitle>Emisor y receptor</CardTitle>
                  <CardDescription>Se usa el emisor autenticado y un receptor registrado.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-3 text-sm">
                    <Info label="Emisor" value={emitter?.nombre || '-'} />
                    <Info label="NIT / NRC" value={`${emitter?.nit || '-'} / ${emitter?.nrc || '-'}`} />
                    <Info label="Actividad" value={emitter?.descripcionActividad || emitter?.codigoActividad || '-'} />
                  </div>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contenido de cada prueba</CardTitle>
                  <CardDescription>Este item se repetira en cada factura del lote.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)_7rem_8rem_8rem]">
                  <div className="grid gap-1">
                    <Label htmlFor="codigo">Codigo</Label>
                    <Input
                      id="codigo"
                      value={line.codigo}
                      onChange={(event) => updateLine({ codigo: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="descripcion">Descripcion</Label>
                    <Input
                      id="descripcion"
                      value={line.descripcion}
                      onChange={(event) => updateLine({ descripcion: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="cantidad">Cantidad</Label>
                    <Input
                      id="cantidad"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.cantidad}
                      onChange={(event) => updateLine({ cantidad: Number(event.target.value) })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="precio">Precio</Label>
                    <Input
                      id="precio"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.precioUni}
                      onChange={(event) => updateLine({ precioUni: Number(event.target.value) })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Total</Label>
                    <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm font-semibold">
                      {money(total)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Configuracion del lote</CardTitle>
                  <CardDescription>Define el total de DTEs y cuantos documentos iran en cada envio por lote.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="batchSize">Cantidad de pruebas</Label>
                    <Input
                      id="batchSize"
                      type="number"
                      min="1"
                      max="1000"
                      step="1"
                      value={batchSize}
                      onChange={(event) => setBatchSize(Number(event.target.value))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="chunkSize">Documentos por envio</Label>
                    <Input
                      id="chunkSize"
                      type="number"
                      min={transmitir ? 2 : 1}
                      max={transmitir ? Math.max(2, Math.min(100, Number(batchSize || 1))) : Math.max(1, Number(batchSize || 1))}
                      step="1"
                      value={chunkSize}
                      onChange={(event) => setChunkSize(Number(event.target.value))}
                    />
                  </div>
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
                    <span>Transmitir los chunks a Hacienda test</span>
                  </label>
                  <div className="grid gap-2">
                    <Label htmlFor="observaciones">Observaciones base</Label>
                    <Input
                      id="observaciones"
                      value={observaciones}
                      onChange={(event) => setObservaciones(event.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="size-5 text-amber-600 dark:text-yellow-300" />
                        Lotes guardados
                      </CardTitle>
                      <CardDescription>Codigos de lote enviados y disponibles para consulta en Hacienda.</CardDescription>
                    </div>
                    <Button type="button" variant="outline" onClick={loadSavedLotes} disabled={loadingSavedLotes}>
                      {loadingSavedLotes ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      Actualizar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="border-b text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">Fecha</th>
                        <th className="py-2 pr-3">Estado</th>
                        <th className="py-2 pr-3">Codigo lote</th>
                        <th className="py-2 pr-3">Docs</th>
                        <th className="py-2 pr-3">Ultima consulta</th>
                        <th className="py-2 pr-3">Resultado</th>
                        <th className="py-2 pr-3">Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedLotes.map((lote) => {
                        const codes = lote.codigosLote?.length
                          ? lote.codigosLote
                          : (lote.codigoLote || '').split(',').map((item) => item.trim()).filter(Boolean);
                        const selectedCode = codes[0] || '';
                        const result = consultaResults[lote.id] || lote.lastConsultaResponse;
                        const resultRows = loteRows(result);
                        const procesados = resultRows.filter((item) => item.estado === 'PROCESADO').length;
                        const rechazados = resultRows.filter((item) => item.estado === 'RECHAZADO').length;
                        const consultaKey = `${lote.id}:${selectedCode}`;

                        return (
                          <tr key={lote.id} className="border-b border-slate-200 align-top last:border-0 dark:border-white/10">
                            <td className="py-3 pr-3 whitespace-nowrap">{formatDate(lote.createdAt)}</td>
                            <td className="py-3 pr-3">
                              <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-zinc-200">
                                {lote.status || '-'}
                              </span>
                            </td>
                            <td className="py-3 pr-3">
                              <div className="grid gap-1">
                                {codes.map((code) => (
                                  <span key={code} className="break-all font-mono text-xs">{code}</span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 pr-3 font-mono">{lote.batchSize || '-'}</td>
                            <td className="py-3 pr-3 whitespace-nowrap">{formatDate(lote.lastConsultedAt)}</td>
                            <td className="py-3 pr-3">
                              {resultRows.length > 0 ? (
                                <div className="grid gap-1 text-xs">
                                  <span>Procesados: {procesados}</span>
                                  <span>Rechazados: {rechazados}</span>
                                  {result?.descripcionMsg && <span className="max-w-xs truncate">{result.descripcionMsg}</span>}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Sin consulta</span>
                              )}
                            </td>
                            <td className="py-3 pr-3">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!selectedCode || consultingLoteId === consultaKey}
                                onClick={() => consultSavedLote(lote, selectedCode)}
                              >
                                {consultingLoteId === consultaKey ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="size-4" />
                                )}
                                Consultar
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {!savedLotes.length && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            Todavia no hay codigos de lote guardados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {rows.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Resultados del lote</CardTitle>
                    <CardDescription>
                      {completed} de {rows.length} procesadas. {successful} exitosas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="border-b text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-3">#</th>
                          <th className="py-2 pr-3">Chunk</th>
                          <th className="py-2 pr-3">Estado</th>
                          <th className="py-2 pr-3">Codigo generacion</th>
                          <th className="py-2 pr-3">Codigo lote</th>
                          <th className="py-2 pr-3">Control</th>
                          <th className="py-2 pr-3">Total</th>
                          <th className="py-2 pr-3">Firma</th>
                          <th className="py-2 pr-3">Hacienda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.index} className="border-b border-slate-200 last:border-0 dark:border-white/10">
                            <td className="py-2 pr-3 font-mono">{row.index}</td>
                            <td className="py-2 pr-3 font-mono">{row.chunk || '-'}</td>
                            <td className="py-2 pr-3">
                              <StatusLabel row={row} />
                            </td>
                            <td className="py-2 pr-3 font-mono text-xs">{row.codigoGeneracion || row.error || '-'}</td>
                            <td className="py-2 pr-3 font-mono text-xs">{row.codigoLote || '-'}</td>
                            <td className="py-2 pr-3 font-mono text-xs">{row.numeroControl || '-'}</td>
                            <td className="py-2 pr-3 font-semibold">{formatMs(row.elapsedMs || row.timing?.totalMs)}</td>
                            <td className="py-2 pr-3">{formatMs(row.timing?.signingMs)}</td>
                            <td className="py-2 pr-3">{formatMs(row.timing?.haciendaMs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </section>

        <aside className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageCheck className="size-5 text-amber-600 dark:text-yellow-300" />
                Lote
              </CardTitle>
              <CardDescription>Pruebas tipo 01 consumidor final.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pruebas</p>
                <p className="mt-1 text-3xl font-black">{Math.max(1, Math.min(1000, Number(batchSize || 1)))}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Chunks de {Math.max(transmitir ? 2 : 1, Math.min(transmitir ? 100 : Number(batchSize || 1), Number(chunkSize || batchSize || 1)))} documentos - {money(total)} por factura
                </p>
              </div>

              <Button
                type="button"
                disabled={loading || submitting}
                onClick={submitBatch}
                className="h-12 w-full bg-yellow-400 font-bold text-black hover:bg-yellow-300"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Procesando lote
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    Ejecutar lote
                  </>
                )}
              </Button>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {rows.length > 0 && (
                <div className="rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-950">
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <ReceiptText className="size-4 text-amber-600 dark:text-yellow-300" />
                    Avance
                  </div>
                  <div className="grid gap-1 text-xs">
                    <span className="break-all">Codigo lote: {codigoLote || '-'}</span>
                    <span>Chunks: {chunks.length || '-'}</span>
                    <span>Procesadas: {completed}/{rows.length}</span>
                    <span>Exitosas: {successful}</span>
                    <span>Errores: {rows.filter((row) => row.status === 'error').length}</span>
                    <span>Tiempo total: {formatMs(batchElapsedMs || undefined)}</span>
                  </div>
                  {chunks.length > 0 && (
                    <div className="mt-3 grid gap-1 border-t border-slate-200 pt-3 text-xs dark:border-white/10">
                      {chunks.map((chunk) => (
                        <span key={chunk.index} className="break-all">
                          Chunk {chunk.index}: {chunk.size} docs - {formatMs(chunk.totalMs)} - {chunk.codigoLote || 'sin envio'}
                        </span>
                      ))}
                    </div>
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

function StatusLabel({ row }: { row: BatchRow }) {
  if (row.status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
        <Loader2 className="size-3 animate-spin" />
        Procesando
      </span>
    );
  }
  if (row.status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900">
        <CheckCircle2 className="size-3" />
        OK
      </span>
    );
  }
  if (row.status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-900">
        <AlertTriangle className="size-3" />
        Error
      </span>
    );
  }
  return <span className="text-muted-foreground">Pendiente</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}
