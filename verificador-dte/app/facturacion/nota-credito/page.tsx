'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileSearch, Loader2, Plus, Search, Trash2, UserRoundSearch } from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/lib/firebase';
import { getHaciendaBrowserToken } from '@/lib/hacienda-token-storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type RelatedCcf = {
  id: string;
  codigoGeneracion: string;
  numeroControl: string;
  fechaEmision: string;
  totalPagar: number;
  receptor?: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  createdAt?: string | null;
};

type Emitter = {
  nit?: string;
  nrc?: string;
  nombre?: string;
  codigoActividad?: string;
  descripcionActividad?: string;
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
  codigoActividad?: string;
  actividadNombre?: string;
};

type NoteLine = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUni: number;
  montoDescu: number;
  ventaTipo: 'gravada' | 'exenta' | 'noSujeta' | 'noGravada';
  uniMedida: number;
  tipoItem: number;
};

type NoteResponse = {
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
  totalNoSuj: number;
  totalExenta: number;
  totalGravada: number;
  subTotalVentas: number;
  ivaTributo: number;
  montoTotalOperacion: number;
  totalNoGravado: number;
  totalPagar: number;
};

const emptyLine: NoteLine = {
  codigo: '',
  descripcion: '',
  cantidad: 1,
  precioUni: 0,
  montoDescu: 0,
  ventaTipo: 'gravada',
  uniMedida: 59,
  tipoItem: 2,
};

const pageSize = 8;
const receptorPageSize = 8;

async function firebaseToken() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sesion no autorizada');
  return token;
}

function money(value: number) {
  return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value || 0);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function asNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-SV', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function lineBase(line: NoteLine) {
  return Math.max(0, asNumber(line.cantidad) * asNumber(line.precioUni));
}

function lineTotal(line: NoteLine) {
  return roundMoney(Math.max(0, lineBase(line) - asNumber(line.montoDescu)));
}

function inferVentaTipo(item: Record<string, unknown>): NoteLine['ventaTipo'] {
  if (asNumber(item.ventaNoSuj) > 0) return 'noSujeta';
  if (asNumber(item.ventaExenta) > 0) return 'exenta';
  if (asNumber(item.noGravado) > 0) return 'noGravada';
  return 'gravada';
}

function mapItem(item: Record<string, unknown>): NoteLine {
  return {
    codigo: asString(item.codigo),
    descripcion: asString(item.descripcion),
    cantidad: asNumber(item.cantidad) || 1,
    precioUni: asNumber(item.precioUni),
    montoDescu: asNumber(item.montoDescu),
    ventaTipo: inferVentaTipo(item),
    uniMedida: Number(item.uniMedida || 59),
    tipoItem: Number(item.tipoItem || 2),
  };
}

function buildLinePayload(line: NoteLine) {
  const net = lineTotal(line);
  return {
    ...line,
    ventaNoSuj: line.ventaTipo === 'noSujeta' ? net : 0,
    ventaExenta: line.ventaTipo === 'exenta' ? net : 0,
    ventaGravada: line.ventaTipo === 'gravada' ? net : 0,
    noGravado: line.ventaTipo === 'noGravada' ? net : 0,
  };
}

function buildSummary(items: NoteLine[]): Summary {
  const summary = items.reduce<Summary>((acc, line) => {
    const payload = buildLinePayload(line);
    acc.totalNoSuj = roundMoney(acc.totalNoSuj + payload.ventaNoSuj);
    acc.totalExenta = roundMoney(acc.totalExenta + payload.ventaExenta);
    acc.totalGravada = roundMoney(acc.totalGravada + payload.ventaGravada);
    acc.totalNoGravado = roundMoney(acc.totalNoGravado + payload.noGravado);
    acc.subTotalVentas = roundMoney(acc.totalNoSuj + acc.totalExenta + acc.totalGravada);
    acc.ivaTributo = roundMoney(acc.totalGravada * 0.13);
    acc.montoTotalOperacion = roundMoney(acc.subTotalVentas + acc.ivaTributo + acc.totalNoGravado);
    acc.totalPagar = acc.montoTotalOperacion;
    return acc;
  }, {
    totalNoSuj: 0,
    totalExenta: 0,
    totalGravada: 0,
    subTotalVentas: 0,
    ivaTributo: 0,
    montoTotalOperacion: 0,
    totalNoGravado: 0,
    totalPagar: 0,
  });
  return summary;
}

export default function NotaCreditoPage() {
  const { appUser, authChecked } = useAuth();
  const [emitter, setEmitter] = useState<Emitter | null>(null);
  const [receptors, setReceptors] = useState<Receptor[]>([]);
  const [selectedReceptorId, setSelectedReceptorId] = useState('');
  const [receptorModalOpen, setReceptorModalOpen] = useState(false);
  const [receptorSearch, setReceptorSearch] = useState('');
  const [receptorPage, setReceptorPage] = useState(1);
  const [documents, setDocuments] = useState<RelatedCcf[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<RelatedCcf | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<NoteLine[]>([{ ...emptyLine }]);
  const [transmitir, setTransmitir] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<NoteResponse | null>(null);
  const [error, setError] = useState('');

  const canUse = appUser?.role === 'cliente' || appUser?.role === 'superadmin';
  const selectedReceptor = useMemo(
    () => receptors.find((r) => String(r.id) === selectedReceptorId),
    [receptors, selectedReceptorId]
  );
  const summary = useMemo(() => buildSummary(items), [items]);
  const exceedsRelated = Boolean(selectedDocument && summary.totalPagar > selectedDocument.totalPagar + 0.001);
  const receptorMismatch = Boolean(
    selectedDocument &&
      selectedReceptor &&
      asString(selectedDocument.receptor?.nit).replace(/\D/g, '') &&
      asString(selectedDocument.receptor?.nit).replace(/\D/g, '') !== asString(selectedReceptor.numeroDocumento).replace(/\D/g, '')
  );

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return documents;
    return documents.filter((doc) => [
      doc.codigoGeneracion,
      doc.numeroControl,
      asString(doc.receptor?.nombre),
      asString(doc.receptor?.nit),
      asString(doc.receptor?.nrc),
    ].some((value) => value.toLowerCase().includes(text)));
  }, [documents, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);

  const filteredReceptors = useMemo(() => {
    const text = receptorSearch.trim().toLowerCase();
    if (!text) return receptors;
    const digits = text.replace(/\D/g, '');
    return receptors.filter((receptor) => {
      const haystack = [
        receptor.nombre,
        receptor.numeroDocumento,
        receptor.nrc,
        receptor.actividadNombre,
      ].map((value) => asString(value).toLowerCase());
      const digitHaystack = [receptor.numeroDocumento, receptor.nrc].map((value) => asString(value).replace(/\D/g, ''));
      return haystack.some((value) => value.includes(text)) ||
        Boolean(digits && digitHaystack.some((value) => value.includes(digits)));
    });
  }, [receptorSearch, receptors]);

  const receptorTotalPages = Math.max(1, Math.ceil(filteredReceptors.length / receptorPageSize));
  const pagedReceptors = filteredReceptors.slice(
    (Math.min(receptorPage, receptorTotalPages) - 1) * receptorPageSize,
    Math.min(receptorPage, receptorTotalPages) * receptorPageSize
  );

  useEffect(() => {
    if (!authChecked || !canUse) return;
    void loadData();
  }, [authChecked, canUse]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    setReceptorPage(1);
  }, [receptorSearch]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const token = await firebaseToken();
      const [emitterRes, receptorsRes, res] = await Promise.all([
        fetch('/api/profile/emisor', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/facturacion/receptors', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/facturacion/credit-note-related?limit=100', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
      ]);
      const emitterPayload = await emitterRes.json().catch(() => ({}));
      const receptorsPayload = await receptorsRes.json().catch(() => ({}));
      const payload = await res.json().catch(() => ({})) as { documents?: RelatedCcf[]; error?: string };
      if (!emitterRes.ok) throw new Error(emitterPayload.error || 'No se pudo cargar el emisor');
      if (!receptorsRes.ok) throw new Error(receptorsPayload.error || 'No se pudieron cargar receptores');
      if (!res.ok) throw new Error(payload.error || 'No se pudieron cargar creditos fiscales');
      setEmitter(emitterPayload.emitter || null);
      setReceptors(receptorsPayload.receptors || []);
      setDocuments(payload.documents || []);
      const first = receptorsPayload.receptors?.[0];
      if (first?.id) setSelectedReceptorId(String(first.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar nota de credito');
    } finally {
      setLoading(false);
    }
  }

  function selectDocument(doc: RelatedCcf) {
    setSelectedDocument(doc);
    setItems(doc.items.map(mapItem));
    const matching = receptors.find((receptor) =>
      asString(receptor.numeroDocumento).replace(/\D/g, '') === asString(doc.receptor?.nit).replace(/\D/g, '')
    );
    if (matching) setSelectedReceptorId(String(matching.id));
    setModalOpen(false);
    setResult(null);
  }

  function selectReceptor(receptor: Receptor) {
    setSelectedReceptorId(String(receptor.id));
    setReceptorModalOpen(false);
  }

  function updateLine(index: number, patch: Partial<NoteLine>) {
    setItems((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setItems((current) => [...current, { ...emptyLine }]);
  }

  function removeLine(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  async function submitNote() {
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      if (!selectedDocument) throw new Error('Selecciona el credito fiscal relacionado.');
      if (!selectedReceptorId) throw new Error('Selecciona el receptor.');
      if (receptorMismatch) throw new Error('El receptor seleccionado no coincide con el receptor del CCF relacionado.');
      if (exceedsRelated) throw new Error('La nota de credito no puede superar el total del CCF relacionado.');
      if (items.some((line) => !line.descripcion.trim())) throw new Error('Cada item debe tener descripcion.');
      if (items.some((line) => line.cantidad <= 0 || line.precioUni <= 0)) throw new Error('Cada item debe tener cantidad y precio mayor a cero.');
      const token = await firebaseToken();
      const res = await fetch('/api/facturacion/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          relatedEmissionId: selectedDocument.id,
          receptorId: Number(selectedReceptorId),
          items: items.map(buildLinePayload),
          transmitir,
          observaciones,
          environment: 'test',
          haciendaToken: transmitir ? getHaciendaBrowserToken('test') : undefined,
        }),
      });
      const payload = await res.json() as NoteResponse;
      if (!res.ok) throw new Error(payload.error || 'No se pudo emitir nota de credito');
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo emitir nota de credito');
    } finally {
      setSubmitting(false);
    }
  }

  if (!authChecked) return null;

  if (!canUse) {
    return (
      <main className="min-h-[calc(100vh-5rem)] bg-background p-4 text-foreground">
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
      <section className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-primary text-primary">
            Facturacion electronica
          </p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Nota de credito</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Documento tipo 05 para anular total o parcialmente un comprobante de credito fiscal emitido al mismo receptor.
              </p>
            </div>
            <Button disabled={loading || submitting} onClick={submitNote} className="h-11 bg-primary font-bold text-black hover:bg-primary/90 lg:min-w-52">
              {submitting ? <><Loader2 className="size-4 animate-spin" /> Procesando</> : 'Firma y envio'}
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
                      <CardDescription>Datos oficiales del emisor y receptor de la nota de credito.</CardDescription>
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
                        <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm md:grid-cols-3">
                          <Info label="Nombre" value={selectedReceptor.nombre || '-'} />
                          <Info label="NIT" value={selectedReceptor.numeroDocumento || '-'} />
                          <Info label="NRC" value={selectedReceptor.nrc || '-'} />
                          <Info label="Actividad" value={selectedReceptor.actividadNombre || selectedReceptor.codigoActividad || '-'} />
                          <Info label="Correo" value={selectedReceptor.correo || '-'} />
                          <Info label="Direccion" value={selectedReceptor.complementoDireccion || '-'} />
                        </div>
                      )}
                      {receptorMismatch && (
                        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                          El receptor seleccionado no coincide con el receptor del credito fiscal relacionado.
                        </p>
                      )}
                    </div>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documento relacionado</CardTitle>
                <CardDescription>Selecciona el credito fiscal que sera anulado total o parcialmente.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button type="button" variant="outline" className="h-auto min-h-11 justify-start gap-3 px-3 py-2 text-left" onClick={() => setModalOpen(true)}>
                  <FileSearch className="size-5 shrink-0 text-primary text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{selectedDocument?.numeroControl || 'Seleccionar credito fiscal'}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {selectedDocument ? `${selectedDocument.codigoGeneracion} - ${money(selectedDocument.totalPagar)}` : 'Lista de CCF emitidos'}
                    </span>
                  </span>
                </Button>
                {selectedDocument && (
                  <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm md:grid-cols-3">
                    <Info label="Receptor" value={asString(selectedDocument.receptor?.nombre) || '-'} />
                    <Info label="NIT / NRC" value={`${asString(selectedDocument.receptor?.nit) || '-'} / ${asString(selectedDocument.receptor?.nrc) || '-'}`} />
                    <Info label="Fecha" value={selectedDocument.fechaEmision || '-'} />
                    <Info label="Codigo generacion" value={selectedDocument.codigoGeneracion} wide />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Items de la nota</CardTitle>
                    <CardDescription>Se cargan desde el CCF. Puedes bajar cantidades o montos para una anulacion parcial.</CardDescription>
                  </div>
                  <Button type="button" variant="outline" onClick={addLine}>
                    <Plus className="size-4" /> Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((line, index) => (
                  <div key={index} className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[7rem_minmax(0,1fr)_6rem_7rem_7rem_8rem_8rem_2.5rem]">
                    <div className="grid gap-1">
                      <Label>Codigo</Label>
                      <Input value={line.codigo} onChange={(event) => updateLine(index, { codigo: event.target.value })} />
                    </div>
                    <div className="grid gap-1">
                      <Label>Descripcion</Label>
                      <Input value={line.descripcion} onChange={(event) => updateLine(index, { descripcion: event.target.value })} />
                    </div>
                    <div className="grid gap-1">
                      <Label>Cantidad</Label>
                      <Input type="number" min="0" step="0.01" value={line.cantidad} onChange={(event) => updateLine(index, { cantidad: Number(event.target.value) })} />
                    </div>
                    <div className="grid gap-1">
                      <Label>Precio</Label>
                      <Input type="number" min="0" step="0.01" value={line.precioUni} onChange={(event) => updateLine(index, { precioUni: Number(event.target.value) })} />
                    </div>
                    <div className="grid gap-1">
                      <Label>Descuento</Label>
                      <Input type="number" min="0" step="0.01" value={line.montoDescu} onChange={(event) => updateLine(index, { montoDescu: Number(event.target.value) })} />
                    </div>
                    <div className="grid gap-1">
                      <Label>Tipo venta</Label>
                      <select value={line.ventaTipo} onChange={(event) => updateLine(index, { ventaTipo: event.target.value as NoteLine['ventaTipo'] })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="gravada">Gravada</option>
                        <option value="exenta">Exenta</option>
                        <option value="noSujeta">No sujeta</option>
                        <option value="noGravada">No gravada</option>
                      </select>
                    </div>
                    <div className="grid gap-1">
                      <Label>Total</Label>
                      <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm font-semibold">{money(lineTotal(line))}</div>
                    </div>
                    <Button type="button" variant="outline" size="icon" className="self-end" disabled={items.length === 1} onClick={() => removeLine(index)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}

                <div className="grid gap-3 pt-3 lg:grid-cols-[minmax(0,1fr)_34rem]">
                  <div className="grid gap-3">
                    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-3 text-sm">
                      <input type="checkbox" checked={transmitir} onChange={(event) => setTransmitir(event.target.checked)} className="size-4 accent-primary" />
                      <span>Transmitir a Hacienda test</span>
                    </label>
                    <div className="grid gap-2">
                      <Label>Observaciones</Label>
                      <Input value={observaciones} onChange={(event) => setObservaciones(event.target.value)} placeholder="Opcional" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resumen del documento</div>
                    <div className="overflow-hidden rounded-lg border border-border text-sm">
                      <SummaryRow label="Total CCF relacionado" value={money(selectedDocument?.totalPagar || 0)} />
                      <SummaryRow label="Sumatoria de ventas" value={money(summary.subTotalVentas)} />
                      <SummaryRow label="Valor del Tributo IVA" value={money(summary.ivaTributo)} />
                      <SummaryRow label="Monto Total de la Operacion" value={money(summary.montoTotalOperacion)} />
                      <SummaryRow label="Total Otros Montos No Afectos" value={money(summary.totalNoGravado)} />
                      <SummaryRow label="Total a Acreditar" value={money(summary.totalPagar)} strong />
                    </div>
                    {exceedsRelated && <p className="mt-2 text-sm font-semibold text-red-600">La nota supera el total del CCF relacionado.</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            {result && <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Nota de credito generada: <span className="font-mono">{result.codigoGeneracion}</span></p>}
          </>
        )}
      </section>

      <Modal open={receptorModalOpen} onClose={() => setReceptorModalOpen(false)} className="w-full max-w-5xl">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Seleccionar receptor</h2>
              <p className="mt-1 text-sm text-muted-foreground">Debe coincidir con el receptor del credito fiscal relacionado.</p>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={receptorSearch} onChange={(event) => setReceptorSearch(event.target.value)} placeholder="Buscar receptor" className="pl-9" autoFocus />
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Nombre</th>
                  <th className="px-3 py-3">NIT</th>
                  <th className="px-3 py-3">NRC</th>
                  <th className="px-3 py-3">Actividad</th>
                  <th className="px-3 py-3">Direccion</th>
                  <th className="px-3 py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody>
                {pagedReceptors.map((receptor) => (
                  <tr key={receptor.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-3 font-semibold">{receptor.nombre || '-'}</td>
                    <td className="px-3 py-3 font-mono text-xs">{receptor.numeroDocumento || '-'}</td>
                    <td className="px-3 py-3 font-mono text-xs">{receptor.nrc || '-'}</td>
                    <td className="px-3 py-3">{receptor.actividadNombre || receptor.codigoActividad || '-'}</td>
                    <td className="px-3 py-3">{receptor.complementoDireccion || '-'}</td>
                    <td className="px-3 py-3 text-right">
                      <Button type="button" size="sm" onClick={() => selectReceptor(receptor)}>Seleccionar</Button>
                    </td>
                  </tr>
                ))}
                {!pagedReceptors.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No se encontraron receptores.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{filteredReceptors.length} receptores - Pagina {Math.min(receptorPage, receptorTotalPages)} de {receptorTotalPages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={receptorPage <= 1} onClick={() => setReceptorPage((value) => Math.max(1, value - 1))}>Anterior</Button>
              <Button type="button" variant="outline" size="sm" disabled={receptorPage >= receptorTotalPages} onClick={() => setReceptorPage((value) => Math.min(receptorTotalPages, value + 1))}>Siguiente</Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} className="w-full max-w-5xl">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Seleccionar credito fiscal</h2>
              <p className="mt-1 text-sm text-muted-foreground">Solo se listan CCF emitidos con items disponibles.</p>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar CCF" className="pl-9" autoFocus />
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Receptor</th>
                  <th className="px-3 py-3">Codigo generacion</th>
                  <th className="px-3 py-3">Control</th>
                  <th className="px-3 py-3">Total</th>
                  <th className="px-3 py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((doc) => (
                  <tr key={doc.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(doc.createdAt)}</td>
                    <td className="px-3 py-3">{asString(doc.receptor?.nombre) || '-'}</td>
                    <td className="px-3 py-3 break-all font-mono text-xs">{doc.codigoGeneracion}</td>
                    <td className="px-3 py-3 break-all font-mono text-xs">{doc.numeroControl}</td>
                    <td className="px-3 py-3 font-semibold">{money(doc.totalPagar)}</td>
                    <td className="px-3 py-3 text-right">
                      <Button type="button" size="sm" onClick={() => selectDocument(doc)}>Seleccionar</Button>
                    </td>
                  </tr>
                ))}
                {!paged.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No hay creditos fiscales disponibles.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{filtered.length} documentos - Pagina {Math.min(page, totalPages)} de {totalPages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Siguiente</Button>
            </div>
          </div>
        </div>
      </Modal>
    </main>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_9rem] border-b border-border last:border-0">
      <div className={`bg-card px-3 py-2 text-right text-foreground ${strong ? 'font-bold' : 'font-semibold'}`}>{label}</div>
      <div className={`bg-muted/40 px-3 py-2 text-right text-foreground ${strong ? 'font-bold' : 'font-medium'}`}>{value}</div>
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
