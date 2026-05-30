'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { ChevronDown, ChevronUp, Download, Filter, ArrowUpDown } from 'lucide-react';

type Reporte = {
  id: string;
  nombre: string;
  tipo: 'Factura' | 'Crédito Fiscal' | 'Nota de Crédito' | 'Otro';
  fecha: string; // ISO yyyy-mm-dd
  total: number;
};

const mockReportes: Reporte[] = [
  { id: 'RPT-001', nombre: 'Factura Julio', tipo: 'Factura', fecha: '2025-07-30', total: 154.75 },
  { id: 'RPT-002', nombre: 'Crédito Fiscal Julio', tipo: 'Crédito Fiscal', fecha: '2025-07-29', total: 212.10 },
  { id: 'RPT-003', nombre: 'Factura Agosto', tipo: 'Factura', fecha: '2025-08-01', total: 990.00 },
];

type SortKey = 'id' | 'nombre' | 'tipo' | 'fecha' | 'total';
type SortDir = 'asc' | 'desc';

const PAGE_SIZES = [10, 25, 50];

export default function ReportesPage() {
  // Estado UI
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<'Todos' | Reporte['tipo']>('Todos');
  const [range, setRange] = useState<DateRange | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [sortKey, setSortKey] = useState<SortKey>('fecha');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Filtrado + orden
  const filtrados = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const byText = (r: Reporte) =>
      !needle ||
      r.nombre.toLowerCase().includes(needle) ||
      r.tipo.toLowerCase().includes(needle) ||
      r.id.toLowerCase().includes(needle);

    const byTipo = (r: Reporte) => tipo === 'Todos' || r.tipo === tipo;

    const byRange = (r: Reporte) => {
      if (!range?.from && !range?.to) return true;
      const d = new Date(r.fecha);
      if (range?.from && d < startOfDay(range.from)) return false;
      if (range?.to && d > endOfDay(range.to)) return false;
      return true;
    };

    const sorted = [...mockReportes]
      .filter(byText)
      .filter(byTipo)
      .filter(byRange)
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        const av =
          sortKey === 'fecha' ? +new Date(a.fecha) :
          sortKey === 'total' ? a.total :
          (a as any)[sortKey];
        const bv =
          sortKey === 'fecha' ? +new Date(b.fecha) :
          sortKey === 'total' ? b.total :
          (b as any)[sortKey];

        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });

    return sorted;
  }, [q, tipo, range, sortKey, sortDir]);

  // Paginación
  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const curPage = Math.min(page, totalPages);
  const items = useMemo(() => {
    const start = (curPage - 1) * pageSize;
    return filtrados.slice(start, start + pageSize);
  }, [filtrados, curPage, pageSize]);

  // Métricas
  const totalMonto = filtrados.reduce((acc, r) => acc + r.total, 0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const exportarExcel = () => {
    // TODO: implementar (XLSX con SheetJS)
    alert('Exportar a Excel (pendiente)');
  };

  const exportarPDF = () => {
    // TODO: implementar (PDF con jsPDF/autoTable)
    alert('Exportar a PDF (pendiente)');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Reportes
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Filtra, ordena y exporta tus reportes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportarExcel}>
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" onClick={exportarPDF}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi title="Registros" value={total.toLocaleString()} />
        <Kpi title="Importe total" value={`$ ${totalMonto.toFixed(2)}`} />
        <Kpi title="Página" value={`${curPage} / ${totalPages}`} />
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Input
                placeholder="Buscar por id, nombre o tipo…"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={tipo}
                onChange={(e) => { setTipo(e.target.value as any); setPage(1); }}
                className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Todos</option>
                <option>Factura</option>
                <option>Crédito Fiscal</option>
                <option>Nota de Crédito</option>
                <option>Otro</option>
              </select>

              <Button
                variant="outline"
                onClick={() => setFiltersOpen(o => !o)}
                className="inline-flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Panel de filtros */}
          {filtersOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="block text-sm text-gray-600 dark:text-gray-400">
                  Rango de fechas
                </span>
                <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-2">
                  <Calendar
                    mode="range"
                    selected={range}
                    onSelect={(v) => { setRange(v); setPage(1); }}
                    numberOfMonths={2}
                    pagedNavigation
                  />
                </div>
              </div>
              <div className="space-y-2">
                <span className="block text-sm text-gray-600 dark:text-gray-400">Acciones</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setRange(undefined); setTipo('Todos'); setQ(''); setPage(1); }}>
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-700 dark:text-gray-300">
              <tr>
                <Th onClick={() => toggleSort('id')} active={sortKey === 'id'} dir={sortDir}>ID</Th>
                <Th onClick={() => toggleSort('nombre')} active={sortKey === 'nombre'} dir={sortDir}>Nombre</Th>
                <Th onClick={() => toggleSort('tipo')} active={sortKey === 'tipo'} dir={sortDir}>Tipo</Th>
                <Th onClick={() => toggleSort('fecha')} active={sortKey === 'fecha'} dir={sortDir}>Fecha</Th>
                <Th onClick={() => toggleSort('total')} active={sortKey === 'total'} dir={sortDir} align="right">Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500 dark:text-gray-400">
                    No hay resultados con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                items.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition">
                    <Td>{r.id}</Td>
                    <Td className="font-medium text-gray-900 dark:text-gray-100">{r.nombre}</Td>
                    <Td>
                      <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs">
                        {r.tipo}
                      </span>
                    </Td>
                    <Td>{new Date(r.fecha).toLocaleDateString()}</Td>
                    <Td align="right">${r.total.toFixed(2)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-900/60">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {total > 0 ? (
              <>
                Mostrando <b className="text-gray-900 dark:text-gray-200">{(curPage - 1) * pageSize + 1}</b> –{' '}
                <b className="text-gray-900 dark:text-gray-200">{Math.min(curPage * pageSize, total)}</b> de{' '}
                <b className="text-gray-900 dark:text-gray-200">{total}</b>
              </>
            ) : 'Sin registros'}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
            >
              {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / pág</option>)}
            </select>

            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={curPage === 1}
            >
              Anterior
            </Button>
            <span className="text-sm text-gray-700 dark:text-gray-300 px-1">
              {curPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={curPage >= totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========= Subcomponentes UI ========= */

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-gray-600 dark:text-gray-400">{title}</div>
        <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{value}</div>
      </CardContent>
    </Card>
  );
}

function Th({
  children, align = 'left', onClick, active, dir,
}: React.PropsWithChildren<{
  align?: 'left' | 'center' | 'right'; onClick?: () => void; active?: boolean; dir?: SortDir;
}>) {
  const map = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
  return (
    <th
      onClick={onClick}
      className={`p-3 font-medium ${map[align]} ${onClick ? 'cursor-pointer select-none' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {onClick && <ArrowUpDown className={`h-4 w-4 ${active ? '' : 'opacity-40'}`} />}
        {active && (dir === 'asc' ? <span className="sr-only">asc</span> : <span className="sr-only">desc</span>)}
      </span>
    </th>
  );
}

function Td({
  children, align = 'left', className = '',
}: React.PropsWithChildren<{ align?: 'left' | 'center' | 'right'; className?: string }>) {
  const map = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
  return <td className={`p-3 ${map[align]} text-gray-800 dark:text-gray-200 ${className}`}>{children}</td>;
}

/* ========= Utils locales ========= */

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
