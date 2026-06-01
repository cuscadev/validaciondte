'use client';

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

export default function GmailDocumentFilters({ filters, onChange, disabled }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="gmail-q">Buscar</Label>
        <Input
          id="gmail-q"
          placeholder="Codigo, NIT, emisor, asunto..."
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gmail-tipo">Tipo DTE</Label>
        <select
          id="gmail-tipo"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
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
          type="date"
          value={filters.dateTo}
          onChange={(e) => onChange({ dateTo: e.target.value })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
