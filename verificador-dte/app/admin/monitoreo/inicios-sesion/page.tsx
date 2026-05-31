'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type LoginLog = {
  id: string;
  email: string;
  role: string;
  success: boolean;
  reason: string;
  provider: string;
  userAgent: string;
  createdAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-SV', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function LoginLogsPage() {
  const [filters, setFilters] = useState({
    email: '',
    outcome: '',
    from: '',
    to: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [actionError, setActionError] = useState('');
  const [clearing, setClearing] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: loginLogs = [],
    error,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['monitoring', 'login-logs', appliedFilters],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const params = new URLSearchParams({ limit: '300' });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const res = await fetch(`/api/login-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { logs?: LoginLog[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los logs de login');
      return data.logs || [];
    },
  });

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    const emptyFilters = { email: '', outcome: '', from: '', to: '' };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const clearLoginLogs = async () => {
    if (!confirm('Esto eliminara los logs de inicio de sesion. Esta accion no elimina usuarios.')) return;
    setClearing(true);
    setActionError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');
      const res = await fetch('/api/login-logs', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudo vaciar loginLogs');
      await queryClient.invalidateQueries({ queryKey: ['monitoring', 'login-logs'] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo vaciar loginLogs');
    } finally {
      setClearing(false);
    }
  };

  const visibleError = actionError || (error instanceof Error ? error.message : '');
  const loading = isFetching || clearing;

  const totals = useMemo(() => {
    return loginLogs.reduce(
      (acc, log) => {
        if (log.success) acc.success += 1;
        else acc.failed += 1;
        return acc;
      },
      { success: 0, failed: 0 }
    );
  }, [loginLogs]);

  return (
    <main className="space-y-5">
      <section className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-yellow-600">Monitoreo</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Inicios de sesion</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Intentos exitosos y fallidos. No se guardan contrasenas.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} disabled={loading}>
              {loading ? 'Cargando...' : 'Actualizar'}
            </Button>
            <Button variant="destructive" onClick={clearLoginLogs} disabled={loading}>
              Vaciar coleccion
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Exitosos</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-600">{totals.success}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Fallidos</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-red-600">{totals.failed}</CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Historial reciente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <section className="rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-3 md:grid-cols-5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Usuario/correo</label>
                <Input value={filters.email} onChange={(event) => updateFilter('email', event.target.value)} placeholder="cliente@empresa.com" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Resultado</label>
                <select
                  value={filters.outcome}
                  onChange={(event) => updateFilter('outcome', event.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Todos</option>
                  <option value="success">Exitosos</option>
                  <option value="failed">Fallidos</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Desde</label>
                <Input type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Hasta</label>
                <Input type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <Button type="button" onClick={() => setAppliedFilters(filters)} disabled={loading} className="flex-1">
                  Aplicar
                </Button>
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Limpiar
                </Button>
              </div>
            </div>
          </section>

          {visibleError ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{visibleError}</div>
          ) : (
            <div className="overflow-auto rounded-md border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Usuario</th>
                    <th className="px-3 py-2 text-left">Rol</th>
                    <th className="px-3 py-2 text-left">Resultado</th>
                    <th className="px-3 py-2 text-left">Motivo</th>
                    <th className="px-3 py-2 text-left">Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  {loginLogs.map((log) => (
                    <tr key={log.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-3 py-2">{log.email || '-'}</td>
                      <td className="px-3 py-2">{log.role || '-'}</td>
                      <td className="px-3 py-2">
                        <Badge className={log.success ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}>
                          {log.success ? 'success' : 'failed'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{log.reason || '-'}</td>
                      <td className="px-3 py-2">{log.provider || '-'}</td>
                    </tr>
                  ))}
                  {!isLoading && loginLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No hay logs de inicio de sesion.</td>
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
