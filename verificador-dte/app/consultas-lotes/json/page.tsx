'use client';

import PlanGate from '@/components/PlanGate';
import UploadFormSection from '@/components/upload/UploadFormSection'
import UploadFormAccordion from '@/components/upload/UploadFormAccordion'
import UploadResultsReveal from '@/components/upload/UploadResultsReveal'
import { useUploadResultsReveal } from '@/components/upload/useUploadResultsReveal'
import { auth } from '@/lib/firebase';
import UploadTableExportBar from '@/components/upload/UploadTableExportBar'
import {
  buildExportFilename,
  exportPdfByProfile,
  exportRowsToCsv,
  exportRowsToExcel,
} from '@/lib/upload-table-export';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
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

type LoteResult = {
  codigoLote: string;
  origen?: string;
  status: 'ok' | 'error';
  error?: string;
  response?: LoteResponse;
};

function estadoClass(estado?: string) {
  if (estado === 'PROCESADO') return 'bg-emerald-500 text-white';
  if (estado === 'RECHAZADO') return 'bg-red-500 text-white';
  return 'bg-slate-500 text-white';
}

function rowsFromResults(results: LoteResult[]) {
  return results.flatMap((result) => {
    const procesados = (result.response?.procesados || []).map((item) => ({
      ...item,
      estado: item.estado || 'PROCESADO',
      codigoLote: result.codigoLote,
      loteStatus: result.status,
      loteError: result.error || '',
    }));
    const rechazados = (result.response?.rechazados || []).map((item) => ({
      ...item,
      estado: item.estado || 'RECHAZADO',
      codigoLote: result.codigoLote,
      loteStatus: result.status,
      loteError: result.error || '',
    }));
    const errorRows = result.status === 'error'
      ? [{
          codigoLote: result.codigoLote,
          estado: 'ERROR',
          descripcionMsg: result.error || 'No se pudo consultar el lote',
          loteStatus: result.status,
          loteError: result.error || '',
        } as LoteItem & { codigoLote: string; loteStatus: string; loteError: string }]
      : [];

    return [...procesados, ...rechazados, ...errorRows];
  });
}

export default function ConsultaLotesJSONPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [environment, setEnvironment] = useState<'test' | 'production'>('test');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<LoteResult[]>([]);
  const {
    resultsVisible,
    accordionApiRef,
    resetResultsVisibility,
    onResultsReveal,
  } = useUploadResultsReveal();

  const allRows = useMemo(() => rowsFromResults(results), [results]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return allRows;

    return allRows.filter((item) =>
      [
        item.codigoLote,
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
  }, [allRows, search]);

  const totals = useMemo(() => {
    return {
      lotes: results.length,
      procesados: results.reduce((acc, item) => acc + (item.response?.procesados?.length || 0), 0),
      rechazados: results.reduce((acc, item) => acc + (item.response?.rechazados?.length || 0), 0),
      errores: results.filter((item) => item.status === 'error').length,
    };
  }, [results]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const files = selectedFiles;

    if (!files.length) {
      toast.warning('Selecciona uno o mas archivos JSON.');
      return;
    }

    setLoading(true);
    resetResultsVisibility();
    setResults([]);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const fd = new FormData();
      fd.set('environment', environment);
      files.forEach((file) => fd.append('files', file));

      const res = await fetch('/api/hacienda/consulta-dte-lote-json', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      });

      const payload = await res.json() as { resultados?: LoteResult[]; error?: string };
      if (!res.ok) {
        throw new Error(payload.error || 'No se pudo consultar los lotes desde JSON');
      }

      const resultados = payload.resultados || [];
      setResults(resultados);
      accordionApiRef.current?.setProcessingSummary(
        summarizeDteUploadResults(resultados)
      );
      toast.success(
        `Consulta finalizada. ${resultados.length} codigo${resultados.length === 1 ? '' : 's'} consultado${resultados.length === 1 ? '' : 's'} por la API Go.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PlanGate routeKey="consulta_lote">
      <main className="space-y-5">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form onSubmit={onSubmit} className="overflow-hidden rounded-lg border border-border">
              <UploadFormAccordion
                accordionApiRef={accordionApiRef}
                onResultsReveal={onResultsReveal}
                hasResults={resultsVisible && results.length > 0}
                collapseWhenResults
              >
              <div className="max-w-xs space-y-2">
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

              <UploadFormSection
                label="Archivos JSON"
                briefHint="JSON con codigoLote"
                helpContent={
                  <>
                    <p>
                      Sube JSON que contengan codigoLote o identificacion.codigoGeneracion. La API Go extrae el codigo y consulta Hacienda usando el ambiente seleccionado.
                    </p>
                    <p className="mt-2 text-xs opacity-90">
                      Si no viene codigoLote, Go usa identificacion.codigoGeneracion como codigo para consultadtelote.
                    </p>
                  </>
                }
                files={selectedFiles}
                onFilesChange={setSelectedFiles}
                loading={loading}
                submitLabel="Consultar"
                submitClassName="w-full sm:w-auto"
                accept={{ 'application/json': ['.json'] }}
              />

              </UploadFormAccordion>
            </form>
          </CardContent>
        </Card>

        <UploadResultsReveal visible={resultsVisible && results.length > 0}>
            <section className="grid gap-3 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Lotes</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{totals.lotes}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Procesados</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold text-emerald-600">{totals.procesados}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Rechazados</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold text-red-600">{totals.rechazados}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Errores</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold text-amber-600">{totals.errores}</CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <CardTitle>Resultados Hacienda</CardTitle>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <UploadTableExportBar
                      excel={{
                        onClick: () =>
                          exportRowsToExcel(
                            allRows as Record<string, unknown>[],
                            buildExportFilename('consultas_lotes', 'xlsx'),
                            'Consultas lotes'
                          ),
                      }}
                      csv={{
                        onClick: () =>
                          exportRowsToCsv(
                            allRows as Record<string, unknown>[],
                            buildExportFilename('consultas_lotes', 'csv')
                          ),
                      }}
                      pdf={{
                        onClick: () =>
                          exportPdfByProfile(
                            allRows as Record<string, unknown>[],
                            'consultasLotes',
                            buildExportFilename('consultas_lotes', 'pdf')
                          ),
                      }}
                    />
                    <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar lote, codigo, mensaje..."
                      className="pl-9"
                    />
                  </div>
                </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto rounded-md border">
                  <table className="w-full min-w-[1150px] text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">Lote</th>
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
                        <tr key={`${item.codigoLote}-${item.codigoGeneracion || index}-${item.estado}`} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">{item.codigoLote}</td>
                          <td className="px-3 py-2">{item.index ?? '-'}</td>
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
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
        </UploadResultsReveal>
      </main>
    </PlanGate>
  );
}
