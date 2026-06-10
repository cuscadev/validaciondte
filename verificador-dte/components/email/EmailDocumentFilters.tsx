'use client';

import { ALLOWED_TIPO_DTE, TIPO_DTE_LABELS } from '@/lib/gmail/parse-dte-import';
import EmailSyncDateField from '@/components/email/EmailSyncDateField';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type EmailCatalogFilters = {
  q: string;
  tipoDte: string;
  dateFrom: string;
  dateTo: string;
};

type Props = {
  filters: EmailCatalogFilters;
  onChange: (patch: Partial<EmailCatalogFilters>) => void;
  disabled?: boolean;
};

export default function EmailDocumentFilters({ filters, onChange, disabled }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="email-q">Buscar</Label>
        <Input
          id="email-q"
          placeholder="Codigo, NIT, emisor, asunto..."
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-tipo">Tipo DTE</Label>
        <select
          id="email-tipo"
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
      <EmailSyncDateField
        id="email-cat-from"
        label="Fec. emision desde"
        isoValue={filters.dateFrom}
        onIsoChange={(iso) => onChange({ dateFrom: iso })}
        disabled={disabled}
      />
      <EmailSyncDateField
        id="email-cat-to"
        label="Fec. emision hasta"
        isoValue={filters.dateTo}
        onIsoChange={(iso) => onChange({ dateTo: iso })}
        disabled={disabled}
      />    </div>
  );
}
