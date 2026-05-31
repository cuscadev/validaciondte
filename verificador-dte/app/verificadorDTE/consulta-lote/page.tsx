'use client';

import PlanGate from '@/components/PlanGate';
import { auth } from '@/lib/firebase';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

type LoteItem = {
  version?: number;
  ambiente?: string;
  versionApp?: number;
  estado?: string;
  codigoGeneracion?: string;
  selloRecibido?: string | null;
  fhProcesamiento?: string;
  clasificaMsg?: string;
  codigoMsg?: string;
  descripcionMsg?: string;
  observaciones?: unknown[];
  index?: number;
};

type LoteResponse = {
  procesados?: LoteItem[];
  rechazados?: LoteItem[];
  error?: string;
};

function estadoClass(estado?: string) {
  if (estado === 'PROCESADO') return 'bg-emerald-500 text-white';
  if (estado === 'RECHAZADO') return 'bg-red-500 text-white';
  return 'bg-slate-500 text-white';
}

export default function ConsultaLotePage() {
  const [codigoLote, setCodigoLote] = useState('');
  const [environment, setEnvironment] = useState<'test' | 'production'>('test');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LoteResponse | null>(null);

  const rows = useMemo(() => {
    const procesados = (data?.procesados || []).map((item) => ({ ...item, estado: item.estado || 'PROCESADO' }));
    const rechazados = (data?.rechazados || []).map((item) => ({ ...item, estado: item.estado || 'RECHAZADO' }));
    const all = [...procesados, ...rechazados];
    const q = search.trim().toLowerCase();

    if (!q) return all;

    return all.filter((item) =>
      [
        item.estado,
        item.codigoGeneracion,
        item.selloRecibido,
        item.codigoMsg,
        item.descripcionMsg,
        item.fhProcesamiento,
        item.index,
      ]
        .filter((value) => value !== undefined && value !== null)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [data, search]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const lote = codigoLote.trim();

    if (!lote) {
      toast.warning('Ingresa el codigo de lote.');
      return;
    }

    setLoading(true);
    setData(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch(`/api/hacienda/consulta-dte-lote/${encodeURIComponent(lote)}?environment=${environment}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json() as LoteResponse;
      if (!res.ok) throw new Error(payload.error || 'No se pudo consultar el lote.');

      setData(payload);
      toast.success('Consulta completada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo consultar el lote.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PlanGate routeKey="consulta_lote">
      <main className="space-y-5">
        <section className="space-y-4">
          <header>
            <h1 className="text-2xl font-semibold">Consulta de lote DTE</h1>
            <p className="text-muted-foreground text-sm">
              Consulta en Hacienda el resultado de un lote enviado previamente usando el codigoLote.
            </p>
          </header>
            <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="ambiente">Ambiente</Label>
                <select
                  id="ambiente"
                  value={environment}
                  onChange={(event) => setEnvironment(event.target.value === 'production' ? 'production' : 'test')}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="test">Pruebas</option>
                  <option value="production">Produccion</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigo-lote">Codigo de lote</Label>
                <Input
                  id="codigo-lote"
                  value={codigoLote}
                  onChange={(event) => setCodigoLote(event.target.value)}
                  placeholder="ECC165D-DEBE-4BDD-BB15-A057A92A795F"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Consultar
              </Button>
            </form>
        </section>

        {data && (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Procesados</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold text-emerald-600">
                  {data.procesados?.length || 0}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Rechazados</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold text-red-600">
                  {data.rechazados?.length || 0}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {(data.procesados?.length || 0) + (data.rechazados?.length || 0)}
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <CardTitle>Resultado del lote</CardTitle>
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar codigo, sello, mensaje..."
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto rounded-md border">
                  <table className="w-full min-w-[1000px] text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">Index</th>
                        <th className="px-3 py-2 text-left">Estado</th>
                        <th className="px-3 py-2 text-left">Codigo generacion</th>
                        <th className="px-3 py-2 text-left">Sello recibido</th>
                        <th className="px-3 py-2 text-left">Fecha procesamiento</th>
                        <th className="px-3 py-2 text-left">Codigo msg</th>
                        <th className="px-3 py-2 text-left">Descripcion</th>
                        <th className="px-3 py-2 text-left">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((item, index) => (
                        <tr key={`${item.codigoGeneracion || index}-${item.estado}`} className="border-t">
                          <td className="px-3 py-2">{item.index ?? index}</td>
                          <td className="px-3 py-2">
                            <Badge className={estadoClass(item.estado)}>{item.estado || '-'}</Badge>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{item.codigoGeneracion || '-'}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.selloRecibido || '-'}</td>
                          <td className="px-3 py-2">{item.fhProcesamiento || '-'}</td>
                          <td className="px-3 py-2">{item.codigoMsg || '-'}</td>
                          <td className="px-3 py-2">{item.descripcionMsg || '-'}</td>
                          <td className="px-3 py-2">
                            {Array.isArray(item.observaciones) && item.observaciones.length
                              ? item.observaciones.map((obs) => String(obs)).join(' | ')
                              : '-'}
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                            No hay resultados para mostrar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </PlanGate>
  );
}
