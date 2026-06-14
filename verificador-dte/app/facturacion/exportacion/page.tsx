'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/lib/firebase';
import { getHaciendaBrowserToken } from '@/lib/hacienda-token-storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

type ExportLine = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUni: number;
  montoDescu: number;
  uniMedida: number;
};

type ExportResponse = {
  success?: boolean;
  id?: string;
  status?: string;
  codigoGeneracion?: string;
  numeroControl?: string;
  totalPagar?: number;
  selloRecepcion?: string;
  error?: string;
};

const emptyLine: ExportLine = {
  codigo: '',
  descripcion: '',
  cantidad: 1,
  precioUni: 0,
  montoDescu: 0,
  uniMedida: 59,
};

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

function lineTotal(line: ExportLine) {
  return roundMoney(Math.max(0, Number(line.cantidad || 0) * Number(line.precioUni || 0) - Number(line.montoDescu || 0)));
}

export default function FacturaExportacionPage() {
  const { appUser, authChecked } = useAuth();
  const [emitter, setEmitter] = useState<Emitter | null>(null);
  const [receptor, setReceptor] = useState({
    tipoDocumento: '37',
    numDocumento: '',
    tipoPersona: 2,
    nombre: '',
    nombreComercial: '',
    codPais: 'US',
    nombrePais: 'Estados Unidos',
    complemento: '',
    descActividad: '',
    telefono: '',
    correo: '',
  });
  const [items, setItems] = useState<ExportLine[]>([{ ...emptyLine }]);
  const [codIncoterms, setCodIncoterms] = useState('02');
  const [descIncoterms, setDescIncoterms] = useState('FCA-Libre transportista');
  const [flete, setFlete] = useState(0);
  const [seguro, setSeguro] = useState(0);
  const [observaciones, setObservaciones] = useState('');
  const [transmitir, setTransmitir] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExportResponse | null>(null);
  const [error, setError] = useState('');

  const canUse = appUser?.role === 'cliente' || appUser?.role === 'superadmin';
  const subtotal = useMemo(() => roundMoney(items.reduce((total, line) => total + lineTotal(line), 0)), [items]);
  const total = useMemo(() => roundMoney(subtotal + Number(flete || 0) + Number(seguro || 0)), [subtotal, flete, seguro]);

  useEffect(() => {
    if (!authChecked || !canUse) return;
    void loadEmitter();
  }, [authChecked, canUse]);

  async function loadEmitter() {
    setLoading(true);
    setError('');
    try {
      const token = await firebaseToken();
      const res = await fetch('/api/profile/emisor', { headers: { Authorization: `Bearer ${token}` } });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'No se pudo cargar el emisor');
      setEmitter(payload.emitter || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar factura de exportacion');
    } finally {
      setLoading(false);
    }
  }

  function updateLine(index: number, patch: Partial<ExportLine>) {
    setItems((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setItems((current) => [...current, { ...emptyLine }]);
  }

  function removeLine(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  async function submitExportInvoice() {
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      if (!receptor.nombre.trim()) throw new Error('Completa el nombre del cliente exterior.');
      if (!receptor.codPais.trim() || !receptor.nombrePais.trim()) throw new Error('Completa el pais del receptor.');
      if (!receptor.complemento.trim()) throw new Error('Completa la direccion internacional del receptor.');
      if (items.some((line) => !line.descripcion.trim())) throw new Error('Cada item debe tener descripcion.');
      if (items.some((line) => line.cantidad <= 0 || line.precioUni <= 0)) throw new Error('Cada item debe tener cantidad y precio mayor a cero.');

      const token = await firebaseToken();
      const res = await fetch('/api/facturacion/export-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          receptor,
          items: items.map((line) => ({
            codigo: line.codigo || undefined,
            descripcion: line.descripcion,
            cantidad: Number(line.cantidad),
            uniMedida: Number(line.uniMedida || 59),
            precioUni: Number(line.precioUni),
            montoDescu: Number(line.montoDescu || 0),
            ventaGravada: lineTotal(line),
            noGravado: 0,
          })),
          codIncoterms,
          descIncoterms,
          flete: Number(flete || 0),
          seguro: Number(seguro || 0),
          observaciones,
          transmitir,
          environment: 'test',
          haciendaToken: transmitir ? getHaciendaBrowserToken('test') : undefined,
        }),
      });
      const payload = await res.json() as ExportResponse;
      if (!res.ok) throw new Error(payload.error || 'No se pudo emitir factura de exportacion');
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo emitir factura de exportacion');
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
      <section className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-primary text-primary">Facturacion electronica</p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Factura de exportacion</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Documento tipo 11 para ventas de bienes o servicios a clientes fuera de El Salvador con IVA tasa cero.
              </p>
            </div>
            <Button disabled={loading || submitting} onClick={submitExportInvoice} className="h-11 bg-primary font-bold text-black hover:bg-primary/90 lg:min-w-52">
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
              <CardHeader>
                <CardTitle>Emisor</CardTitle>
                <CardDescription>Datos fiscales configurados para la empresa emisora.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-3">
                <Info label="Nombre" value={emitter?.nombre || '-'} />
                <Info label="NIT / NRC" value={`${emitter?.nit || '-'} / ${emitter?.nrc || '-'}`} />
                <Info label="Actividad" value={emitter?.descripcionActividad || emitter?.codigoActividad || '-'} />
                <Info label="Direccion" value={emitter?.complementoDireccion || '-'} wide />
                <Info label="Telefono" value={emitter?.telefono || '-'} />
                <Info label="Correo" value={emitter?.correo || '-'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Receptor internacional</CardTitle>
                <CardDescription>Cliente del exterior y pais de destino de la exportacion.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <Field label="Nombre" value={receptor.nombre} onChange={(value) => setReceptor((current) => ({ ...current, nombre: value }))} />
                <Field label="Nombre comercial" value={receptor.nombreComercial} onChange={(value) => setReceptor((current) => ({ ...current, nombreComercial: value }))} />
                <Field label="Documento" value={receptor.numDocumento} onChange={(value) => setReceptor((current) => ({ ...current, numDocumento: value }))} />
                <Field label="Codigo pais" value={receptor.codPais} onChange={(value) => setReceptor((current) => ({ ...current, codPais: value.toUpperCase() }))} />
                <Field label="Nombre pais" value={receptor.nombrePais} onChange={(value) => setReceptor((current) => ({ ...current, nombrePais: value }))} />
                <Field label="Actividad" value={receptor.descActividad} onChange={(value) => setReceptor((current) => ({ ...current, descActividad: value }))} />
                <Field label="Correo" value={receptor.correo} onChange={(value) => setReceptor((current) => ({ ...current, correo: value }))} />
                <Field label="Telefono" value={receptor.telefono} onChange={(value) => setReceptor((current) => ({ ...current, telefono: value }))} />
                <Field label="Direccion exterior" value={receptor.complemento} onChange={(value) => setReceptor((current) => ({ ...current, complemento: value }))} className="md:col-span-3" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Items de exportacion</CardTitle>
                    <CardDescription>Los valores se registran a tasa 0. Puedes agregar flete y seguro en el resumen.</CardDescription>
                  </div>
                  <Button type="button" variant="outline" onClick={addLine}><Plus className="size-4" /> Item</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((line, index) => (
                  <div key={index} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[7rem_minmax(0,1fr)_6rem_7rem_7rem_7rem_2.5rem] border-border bg-background">
                    <Field label="Codigo" value={line.codigo} onChange={(value) => updateLine(index, { codigo: value })} />
                    <Field label="Descripcion" value={line.descripcion} onChange={(value) => updateLine(index, { descripcion: value })} />
                    <NumberField label="Cantidad" value={line.cantidad} onChange={(value) => updateLine(index, { cantidad: value })} />
                    <NumberField label="Precio" value={line.precioUni} onChange={(value) => updateLine(index, { precioUni: value })} />
                    <NumberField label="Descuento" value={line.montoDescu} onChange={(value) => updateLine(index, { montoDescu: value })} />
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
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Cod. Incoterms" value={codIncoterms} onChange={setCodIncoterms} />
                      <Field label="Descripcion Incoterms" value={descIncoterms} onChange={setDescIncoterms} />
                      <NumberField label="Flete" value={flete} onChange={setFlete} />
                      <NumberField label="Seguro" value={seguro} onChange={setSeguro} />
                    </div>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm border-border bg-background">
                      <input type="checkbox" checked={transmitir} onChange={(event) => setTransmitir(event.target.checked)} className="size-4 accent-primary" />
                      <span>Transmitir a Hacienda test</span>
                    </label>
                    <Field label="Observaciones" value={observaciones} onChange={setObservaciones} />
                  </div>
                  <div>
                    <div className="mb-2 text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resumen del documento</div>
                    <div className="overflow-hidden rounded-lg border border-slate-200 text-sm border-border">
                      <SummaryRow label="Total exportacion" value={money(subtotal)} />
                      <SummaryRow label="Flete" value={money(flete)} />
                      <SummaryRow label="Seguro" value={money(seguro)} />
                      <SummaryRow label="Total a Pagar" value={money(total)} strong />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            {result && <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Factura de exportacion generada: <span className="font-mono">{result.codigoGeneracion}</span></p>}
          </>
        )}
      </section>
    </main>
  );
}

function Field({ label, value, onChange, className = '' }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <div className={`grid gap-1 ${className}`}>
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Input type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_9rem] border-b border-slate-200 last:border-0 border-border">
      <div className={`bg-white px-3 py-2 text-right bg-card ${strong ? 'font-bold' : 'font-semibold'}`}>{label}</div>
      <div className={`bg-slate-50 px-3 py-2 text-right bg-background ${strong ? 'font-bold' : 'font-medium'}`}>{value}</div>
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
