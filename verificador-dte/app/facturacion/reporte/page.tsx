'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RefreshCcw, Search, Send } from 'lucide-react';

import { auth } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';

type EmittedDte = {
  id: string;
  tipoDte?: string;
  status?: string;
  codigoGeneracion?: string;
  numeroControl?: string;
  selloRecepcion?: string;
  totalPagar?: number;
  createdAt?: string | null;
};

const pageSize = 12;

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

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function tipoLabel(tipo?: string) {
  if (tipo === '01') return 'Factura';
  if (tipo === '03') return 'Credito fiscal';
  if (tipo === '05') return 'Nota de credito';
  if (tipo === '06') return 'Nota de debito';
  if (tipo === '11') return 'Factura de exportacion';
  if (tipo === '14') return 'Sujeto excluido';
  return tipo || '-';
}

export default function FacturacionReportePage() {
  const { appUser, authChecked } = useAuth();
  const [rows, setRows] = useState<EmittedDte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [tipoDte, setTipoDte] = useState('');
  const [page, setPage] = useState(1);
  const [sendTarget, setSendTarget] = useState<{ id: string; name: string } | null>(null);
  const [sendEmail, setSendEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendMessage, setSendMessage] = useState('');

  const canUse = appUser?.role === 'cliente' || appUser?.role === 'superadmin';

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows
      .filter((row) => !tipoDte || row.tipoDte === tipoDte)
      .filter((row) => {
        if (!text) return true;
        return [
          row.codigoGeneracion,
          row.numeroControl,
          row.selloRecepcion,
          row.status,
          tipoLabel(row.tipoDte),
        ].some((value) => String(value || '').toLowerCase().includes(text));
      });
  }, [query, rows, tipoDte]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedRows = filtered.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);

  useEffect(() => {
    if (!authChecked || !canUse) return;
    void loadRows();
  }, [authChecked, canUse]);

  useEffect(() => {
    setPage(1);
  }, [query, tipoDte]);

  async function loadRows() {
    setLoading(true);
    setError('');
    try {
      const token = await firebaseToken();
      const res = await fetch('/api/facturacion/emissions?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => ({})) as { emissions?: EmittedDte[]; error?: string };
      if (!res.ok) throw new Error(payload.error || 'No se pudieron cargar DTE emitidos');
      setRows(payload.emissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar DTE emitidos');
    } finally {
      setLoading(false);
    }
  }

  async function downloadEmission(id: string, format: 'json' | 'pdf', fallbackName: string) {
    try {
      const token = await firebaseToken();
      const res = await fetch(`/api/facturacion/emissions/${encodeURIComponent(id)}/${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`No se pudo descargar el ${format.toUpperCase()}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fallbackName || id}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : `No se pudo descargar el ${format.toUpperCase()}`);
    }
  }

  function openSendModal(id: string, name: string) {
    setSendTarget({ id, name });
    setSendEmail('');
    setSendMessage('');
  }

  async function sendEmission() {
    if (!sendTarget) return;
    setSendingEmail(true);
    setError('');
    setSendMessage('');
    try {
      const token = await firebaseToken();
      const res = await fetch(`/api/facturacion/emissions/${encodeURIComponent(sendTarget.id)}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: sendEmail }),
      });
      const payload = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(payload.error || 'No se pudo enviar el correo');
      setSendMessage('Correo enviado correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el correo');
    } finally {
      setSendingEmail(false);
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
      <div className="space-y-4 p-0">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Reporte de DTE emitidos</CardTitle>
                <CardDescription>Documentos procesados individualmente con descarga de PDF/JSON y envio por correo.</CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={loadRows} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar codigo, control, sello o estado" className="pl-9" />
              </div>
              <select
                value={tipoDte}
                onChange={(event) => setTipoDte(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos los DTE</option>
                <option value="01">Factura</option>
                <option value="03">Credito fiscal</option>
                <option value="05">Nota de credito</option>
                <option value="06">Nota de debito</option>
                <option value="11">Factura de exportacion</option>
                <option value="14">Sujeto excluido</option>
              </select>
            </div>

            {error && (
              <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                {error}
              </p>
            )}

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground dark:border-white/10 dark:bg-black">
                  <tr>
                    <th className="px-3 py-3">Fecha</th>
                    <th className="px-3 py-3">Tipo</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Codigo generacion</th>
                    <th className="px-3 py-3">Numero control</th>
                    <th className="px-3 py-3">Sello</th>
                    <th className="px-3 py-3">Total</th>
                    <th className="px-3 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((dte) => (
                    <tr key={dte.id} className="border-b border-slate-200 last:border-0 dark:border-white/10">
                      <td className="px-3 py-3 whitespace-nowrap">{formatDate(dte.createdAt)}</td>
                      <td className="px-3 py-3">{tipoLabel(dte.tipoDte)}</td>
                      <td className="px-3 py-3">{dte.status || '-'}</td>
                      <td className="px-3 py-3 break-all font-mono text-xs">{dte.codigoGeneracion || '-'}</td>
                      <td className="px-3 py-3 break-all font-mono text-xs">{dte.numeroControl || '-'}</td>
                      <td className="px-3 py-3 break-all font-mono text-xs">{dte.selloRecepcion || '-'}</td>
                      <td className="px-3 py-3 font-semibold">{money(Number(dte.totalPagar || 0))}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => downloadEmission(dte.id, 'json', dte.codigoGeneracion || 'dte')}>
                            JSON
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => downloadEmission(dte.id, 'pdf', dte.codigoGeneracion || 'dte')}>
                            PDF
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => openSendModal(dte.id, dte.codigoGeneracion || 'dte')}>
                            <Send className="size-4" />
                            Enviar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!pagedRows.length && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                        No hay DTE emitidos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>{filtered.length} documentos · Pagina {Math.min(page, totalPages)} de {totalPages}</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  Anterior
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                  Siguiente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal open={Boolean(sendTarget)} onClose={() => setSendTarget(null)} disableClose={sendingEmail} className="w-full max-w-md">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">Enviar DTE</h2>
            <p className="mt-1 break-all text-sm text-muted-foreground">{sendTarget?.name}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="send-email">Correo del cliente</Label>
            <Input id="send-email" type="email" value={sendEmail} onChange={(event) => setSendEmail(event.target.value)} placeholder="cliente@correo.com" />
          </div>
          {sendMessage && (
            <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {sendMessage}
            </p>
          )}
          <Button type="button" className="w-full" onClick={sendEmission} disabled={sendingEmail || !sendEmail.trim()}>
            {sendingEmail ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Enviar PDF y JSON
          </Button>
        </div>
      </Modal>
    </main>
  );
}
