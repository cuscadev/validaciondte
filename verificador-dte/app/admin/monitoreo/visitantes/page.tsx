'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, CalendarDays, MousePointerClick, RefreshCw } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { QUERY_CACHE_MS } from '@/components/QueryProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type LandingVisitDay = {
  id: string;
  date: string;
  count: number;
  uniqueCount: number;
  updatedAt: string | null;
};

type LandingVisitsResponse = {
  total: number;
  totalUnique: number;
  days: LandingVisitDay[];
  error?: string;
};

function getTodayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString('es-SV', {
    dateStyle: 'medium',
  });
}

function formatDateTime(value: string | null) {
  if (!value) return '-';

  return new Date(value).toLocaleString('es-SV', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function LandingVisitorsPage() {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const {
    data,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['monitoring', 'landing-visits', appliedFilters],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const params = new URLSearchParams({ limit: '180' });
      if (appliedFilters.from) params.set('from', appliedFilters.from);
      if (appliedFilters.to) params.set('to', appliedFilters.to);

      const res = await fetch(`/api/landing-visits?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseData = (await res.json()) as LandingVisitsResponse;
      if (!res.ok) {
        throw new Error(responseData.error || 'No se pudieron cargar las visitas');
      }

      return responseData;
    },
    staleTime: QUERY_CACHE_MS,
    gcTime: QUERY_CACHE_MS,
  });

  const days = data?.days || [];
  const todayKey = getTodayKey();

  const totals = useMemo(() => {
    const today = days.find((day) => day.date === todayKey)?.count || 0;
    const todayUnique =
      days.find((day) => day.date === todayKey)?.uniqueCount || 0;
    const period = days.reduce((sum, day) => sum + day.count, 0);
    const periodUnique = days.reduce((sum, day) => sum + day.uniqueCount, 0);
    const bestDay = days.reduce<LandingVisitDay | null>(
      (best, day) => (!best || day.count > best.count ? day : best),
      null
    );

    return {
      total: data?.total || 0,
      totalUnique: data?.totalUnique || 0,
      today,
      todayUnique,
      period,
      periodUnique,
      bestDay,
    };
  }, [data?.total, data?.totalUnique, days, todayKey]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    const emptyFilters = { from: '', to: '' };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  return (
    <main className="space-y-5">
      <section className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-yellow-600">
              Monitoreo
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Visitantes landing
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Conteo anonimo de ingresos a la landing. Tambien se calcula un estimado de visitantes unicos por dia sin guardar la IP en texto plano.
            </p>
          </div>

          <Button onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className="mr-2 size-4" />
            {isFetching ? 'Cargando...' : 'Actualizar'}
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ingresos historicos</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <MousePointerClick className="size-5 text-yellow-500" />
            {totals.total}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ingresos hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-semibold">
              <Activity className="size-5 text-yellow-500" />
              {totals.today}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {totals.todayUnique} unicos estimados
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rango visible</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarDays className="size-5 text-yellow-500" />
            {totals.period}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unicos historicos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totals.totalUnique}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {totals.periodUnique} en el rango visible
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Ingresos por dia</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <section className="rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Desde</label>
                <Input
                  type="date"
                  value={filters.from}
                  onChange={(event) => updateFilter('from', event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Hasta</label>
                <Input
                  type="date"
                  value={filters.to}
                  onChange={(event) => updateFilter('to', event.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button type="button" onClick={applyFilters} disabled={isFetching}>
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
                : 'No se pudieron cargar las visitas'}
            </div>
          ) : (
            <div className="overflow-auto rounded-md border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Ingresos</th>
                    <th className="px-3 py-2 text-left">Unicos estimados</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-left">Ultima actualizacion</th>
                  </tr>
                </thead>

                <tbody>
                  {days.map((day) => (
                    <tr key={day.id} className="border-t">
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatDate(day.date)}
                      </td>
                      <td className="px-3 py-2 text-lg font-semibold">
                        {day.count}
                      </td>
                      <td className="px-3 py-2">{day.uniqueCount}</td>
                      <td className="px-3 py-2">
                        <Badge
                          className={
                            day.date === todayKey
                              ? 'bg-yellow-400 text-black'
                              : 'bg-slate-200 text-slate-900'
                          }
                        >
                          {day.date === todayKey ? 'Hoy' : 'Historico'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{formatDateTime(day.updatedAt)}</td>
                    </tr>
                  ))}

                  {!isLoading && days.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        No hay ingresos registrados para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
