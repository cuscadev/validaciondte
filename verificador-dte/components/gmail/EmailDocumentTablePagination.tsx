'use client';

import { Button } from '@/components/ui/button';

const PAGE_SIZES = [25, 50, 100] as const;

type Props = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export default function EmailDocumentTablePagination({
  page,
  pageSize,
  total,
  totalPages,
  loading,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-zinc-900/40 md:flex-row md:items-center md:justify-between">
      <div className="text-xs text-slate-600 dark:text-zinc-400">
        {total > 0 ? (
          <>
            Mostrando <span className="font-semibold text-slate-900 dark:text-white">{start}</span>
            {' – '}
            <span className="font-semibold text-slate-900 dark:text-white">{end}</span> de{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{total}</span>
          </>
        ) : (
          'Sin registros'
        )}
        {total > pageSize ? (
          <span className="mt-1 block text-slate-500 dark:text-zinc-500">
            Usa la paginacion para ver todos los documentos.
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={loading}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-zinc-900 dark:text-white"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} / pag
            </option>
          ))}
        </select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={loading || page <= 1}
        >
          Anterior
        </Button>
        <span className="px-1 text-sm text-slate-700 dark:text-zinc-300">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={loading || page >= totalPages}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
