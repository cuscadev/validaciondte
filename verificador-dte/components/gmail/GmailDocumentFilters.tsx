'use client';

import { Search } from 'lucide-react';

import { ALLOWED_TIPO_DTE, TIPO_DTE_LABELS } from '@/lib/gmail/parse-dte-import';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type GmailCatalogFilters = {
  q: string;
  tipoDte: string;
  dateFrom: string;
  dateTo: string;
};

type Props = {
  filters: GmailCatalogFilters;
  onChange: (patch: Partial<GmailCatalogFilters>) => void;
  disabled?: boolean;
};

const selectClassName =
  'flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 dark:border-white/10 dark:bg-zinc-900';

export default function GmailDocumentFilters({ filters, onChange, disabled }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-zinc-900/40">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
        Filtros del catalogo
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="gmail-q">Buscar documento</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="gmail-q"
              className="h-10 pl-9"
              placeholder="Codigo, NIT, emisor, asunto..."
              value={filters.q}
              onChange={(e) => onChange({ q: e.target.value })}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gmail-tipo">Tipo DTE</Label>
          <select
            id="gmail-tipo"
            className={selectClassName}
            value={filters.tipoDte}
            onChange={(e) => onChange({ tipoDte: e.target.value })}
            disabled={disabled}
          >
            <option value="">Todos los permitidos</option>
            {Array.from(ALLOWED_TIPO_DTE).map((code) => (
              <option key={code} value={code}>
                {code} — {TIPO_DTE_LABELS[code]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gmail-cat-from">Fec. emision desde</Label>
          <Input
            id="gmail-cat-from"
            className="h-10"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gmail-cat-to">Fec. emision hasta</Label>
          <Input
            id="gmail-cat-to"
            className="h-10"
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
