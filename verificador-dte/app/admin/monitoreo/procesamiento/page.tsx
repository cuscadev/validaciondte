'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCursorPaginatedGetQuery } from '@/lib/tanstack-query';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Search,
} from 'lucide-react';

type ProcessingLog = {
  id: string;
  email: string;
  role: string;
  source?: string;
  licenseKey?: string;
  deviceId?: string;
  deviceName?: string;
  ipAddress?: string;
  routeKey: string;
  moduleName: string;
  createdAt: string | null;
  startedAt: string | null;
  durationMs: number;
  waitSeconds: number;
  files: {
    count: number;
    totalBytes: number;
    extensions: string[];
    mimeTypes: string[];
  };
  totalRecords: number;
  successCount: number;
  errorCount: number;
  outcome: 'success' | 'partial' | 'error';
  statusBreakdown: Record<string, number>;
  errorMessage?: string;
};

type ProcessingLogsResponse = {
  logs: ProcessingLog[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  totalReturned: number;
  error?: string;
};

const PAGE_SIZE_OPTIONS = [5, 10, 20];

function formatDate(value: string | null) {
  if (!value) return '-';

  return new Date(value).toLocaleString('es-SV', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms)) return '-';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function outcomeClass(outcome: string) {
  if (outcome === 'success') return 'bg-emerald-500 text-white';
  if (outcome === 'partial') return 'bg-amber-500 text-black';
  return 'bg-red-500 text-white';
}

export default function ProcessingLogsPage() {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [cursorStack, setCursorStack] = useState<string[]>(['']);

  const [filters, setFilters] = useState({
    email: '',
    module: '',
    outcome: '',
    from: '',
    to: '',
    minFiles: '',
    maxFiles: '',
    minRecords: '',
  });

  const [appliedFilters, setAppliedFilters] = useState(filters);

  const currentCursor = cursorStack[pageIndex] || '';

  const {
    data,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useCursorPaginatedGetQuery<ProcessingLogsResponse>({
    queryKeyBase: ['monitoring', 'processing-logs'],
    path: '/api/processing-logs',
    pageIndex,
    cursor: currentCursor,
    pageSize,
    filters: appliedFilters,
    getNextCursor: (response) => response?.nextCursor ?? null,
    hasMore: (response) => Boolean(response?.hasMore && response?.nextCursor),
  });

  const logs = data?.logs || [];
  const hasMore = Boolean(data?.hasMore && data?.nextCursor);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
    setPageIndex(0);
    setCursorStack(['']);
  };

  const clearFilters = () => {
    const emptyFilters = {
      email: '',
      module: '',
      outcome: '',
      from: '',
      to: '',
      minFiles: '',
      maxFiles: '',
      minRecords: '',
    };

    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setSearch('');
    setPageIndex(0);
    setCursorStack(['']);
  };

  const changePageSize = (value: string) => {
    const nextPageSize = Number(value);

    if (!PAGE_SIZE_OPTIONS.includes(nextPageSize)) return;

    setPageSize(nextPageSize);
    setPageIndex(0);
    setCursorStack(['']);
  };

  const goNextPage = () => {
    if (!data?.nextCursor) return;

    setCursorStack((current) => {
      const nextStack = current.slice(0, pageIndex + 1);
      nextStack[pageIndex + 1] = data.nextCursor || '';
      return nextStack;
    });

    setPageIndex((current) => current + 1);
  };

  const goPreviousPage = () => {
    setPageIndex((current) => Math.max(current - 1, 0));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return logs;

    return logs.filter((log) =>
      [
        log.email,
        log.role,
        log.routeKey,
        log.moduleName,
        log.outcome,
        log.source,
        log.licenseKey,
        log.deviceId,
        log.deviceName,
        log.ipAddress,
        log.files?.extensions?.join(' '),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [logs, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, log) => {
        acc.files += log.files?.count || 0;
        acc.records += log.totalRecords || 0;
        acc.success += log.successCount || 0;
        acc.errors += log.errorCount || 0;
        acc.duration += log.durationMs || 0;
        return acc;
      },
      {
        files: 0,
        records: 0,
        success: 0,
        errors: 0,
        duration: 0,
      }
    );
  }, [filtered]);

  return (
    <main className="space-y-5">
      <section className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-yellow-600">
              Monitoreo
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Procesamiento de archivos
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Auditoria de uso sin guardar archivos ni contenido procesado.
            </p>
          </div>

          <Button onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Cargando...' : 'Actualizar'}
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Archivos</CardTitle>
          </CardHeader>

          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <FileText className="size-5 text-yellow-500" />
            {totals.files}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Registros</CardTitle>
          </CardHeader>

          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <Activity className="size-5 text-yellow-500" />
            {totals.records}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Exitos / errores</CardTitle>
          </CardHeader>

          <CardContent className="text-2xl font-semibold">
            {totals.success} / {totals.errors}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tiempo total</CardTitle>
          </CardHeader>

          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <Clock className="size-5 text-yellow-500" />
            {formatDuration(totals.duration)}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Historial reciente</CardTitle>

              <p className="mt-1 text-xs text-muted-foreground">
                Página {pageIndex + 1} · Mostrando {filtered.length} de{' '}
                {logs.length} registros cargados
              </p>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar en esta página..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <section className="rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Usuario/correo
                </label>

                <Input
                  value={filters.email}
                  onChange={(event) =>
                    updateFilter('email', event.target.value)
                  }
                  placeholder="cliente@empresa.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Modulo
                </label>

                <select
                  value={filters.module}
                  onChange={(event) =>
                    updateFilter('module', event.target.value)
                  }
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Todos</option>
                  <option value="verificador">Verificador Links CSV</option>
                  <option value="verificadorjson">Verificador JSON</option>
                  <option value="verificarodyfecha">
                    Verificar Codigo y Fecha
                  </option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Resultado
                </label>

                <select
                  value={filters.outcome}
                  onChange={(event) =>
                    updateFilter('outcome', event.target.value)
                  }
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Todos</option>
                  <option value="success">Exitoso</option>
                  <option value="partial">Parcial</option>
                  <option value="error">Error</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Min. registros
                </label>

                <Input
                  type="number"
                  min="0"
                  value={filters.minRecords}
                  onChange={(event) =>
                    updateFilter('minRecords', event.target.value)
                  }
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Desde
                </label>

                <Input
                  type="date"
                  value={filters.from}
                  onChange={(event) =>
                    updateFilter('from', event.target.value)
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Hasta
                </label>

                <Input
                  type="date"
                  value={filters.to}
                  onChange={(event) => updateFilter('to', event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Min. archivos
                </label>

                <Input
                  type="number"
                  min="0"
                  value={filters.minFiles}
                  onChange={(event) =>
                    updateFilter('minFiles', event.target.value)
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Max. archivos
                </label>

                <Input
                  type="number"
                  min="0"
                  value={filters.maxFiles}
                  onChange={(event) =>
                    updateFilter('maxFiles', event.target.value)
                  }
                />
              </div>

              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  onClick={applyFilters}
                  disabled={isFetching}
                  className="flex-1"
                >
                  Aplicar
                </Button>

                <Button type="button" variant="outline" onClick={clearFilters}>
                  Limpiar
                </Button>
              </div>
            </div>
          </section>

          {error ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error instanceof Error
                ? error.message
                : 'No se pudieron cargar los logs'}
            </div>
          ) : (
            <>
              <div className="overflow-auto rounded-md border">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Usuario</th>
                      <th className="px-3 py-2 text-left">Origen</th>
                      <th className="px-3 py-2 text-left">Licencia</th>
                      <th className="px-3 py-2 text-left">Dispositivo</th>
                      <th className="px-3 py-2 text-left">IP</th>
                      <th className="px-3 py-2 text-left">Modulo</th>
                      <th className="px-3 py-2 text-left">Archivos</th>
                      <th className="px-3 py-2 text-left">Tipos</th>
                      <th className="px-3 py-2 text-left">Registros</th>
                      <th className="px-3 py-2 text-left">Exitos</th>
                      <th className="px-3 py-2 text-left">Errores</th>
                      <th className="px-3 py-2 text-left">Tiempo</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((log) => (
                      <tr key={log.id} className="border-t">
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatDate(log.createdAt || log.startedAt)}
                        </td>

                        <td className="px-3 py-2">
                          <div className="font-medium">{log.email || '-'}</div>

                          <div className="text-xs text-muted-foreground">
                            {log.role || '-'}
                          </div>
                        </td>

                        <td className="px-3 py-2">{log.source || 'web'}</td>

                        <td className="px-3 py-2">
                          {log.licenseKey || '-'}
                        </td>

                        <td className="px-3 py-2">
                          {log.deviceName || log.deviceId || '-'}
                        </td>

                        <td className="px-3 py-2">
                          {log.ipAddress || '-'}
                        </td>

                        <td className="px-3 py-2">
                          {log.moduleName || log.routeKey}
                        </td>

                        <td className="px-3 py-2">
                          <div>{log.files?.count || 0}</div>

                          <div className="text-xs text-muted-foreground">
                            {formatBytes(log.files?.totalBytes || 0)}
                          </div>
                        </td>

                        <td className="px-3 py-2">
                          {log.files?.extensions?.join(', ') || '-'}
                        </td>

                        <td className="px-3 py-2">
                          {log.totalRecords || 0}
                        </td>

                        <td className="px-3 py-2 text-emerald-600">
                          {log.successCount || 0}
                        </td>

                        <td className="px-3 py-2 text-red-600">
                          {log.errorCount || 0}
                        </td>

                        <td className="px-3 py-2">
                          {formatDuration(log.durationMs || 0)}
                        </td>

                        <td className="px-3 py-2">
                          <Badge className={outcomeClass(log.outcome)}>
                            {log.outcome}
                          </Badge>
                        </td>
                      </tr>
                    ))}

                    {!isLoading && filtered.length === 0 && (
                      <tr>
                        <td
                          colSpan={14}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          No hay logs para mostrar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
                  <p className="text-sm text-muted-foreground">
                    Página {pageIndex + 1} · {pageSize} registros por página
                  </p>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor="rows-per-page"
                    className="text-sm text-muted-foreground"
                  >
                    Filas
                  </label>

                  <select
                    id="rows-per-page"
                    value={pageSize}
                    onChange={(event) => {
                      changePageSize(event.target.value)
                    }}
                    disabled={isFetching}
                    className="
                      h-9
                      rounded-md
                      border
                      border-slate-200
                      bg-white
                      px-2
                      text-sm
                      shadow-sm
                      transition-colors
                      focus:outline-none
                      focus:ring-2
                      focus:ring-yellow-400
                      dark:border-white/10
                      dark:bg-zinc-950
                    "
                  >
                    {[5, 10, 20].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goPreviousPage}
                    disabled={pageIndex === 0 || isFetching}
                  >
                    <ChevronLeft className="mr-1 size-4" />
                    Anterior
                  </Button>

                  <Button
                    type="button"
                    onClick={goNextPage}
                    disabled={!hasMore || isFetching}
                  >
                    Siguiente
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
