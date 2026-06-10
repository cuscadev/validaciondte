'use client';

import { STATUS_LABELS } from '@/components/email/EmailDocumentTable';
import type { EmailSyncJobResultRow } from '@/lib/supabase-admin';
import { cn } from '@/lib/utils';

type Props = {
  results: EmailSyncJobResultRow[];
  selectedIds?: Set<string>;
  onToggleSelect?: (documentId: string) => void;
  onToggleAll?: (checked: boolean) => void;
  showSelection?: boolean;
  emptyMessage?: string;
};

const STATUS_BADGE: Record<string, string> = {
  imported: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  skipped_duplicate: 'bg-amber-500/15 text-amber-900 dark:text-amber-200',
  skipped_date: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  skipped_invalid: 'bg-red-500/15 text-red-800 dark:text-red-300',
  skipped_unsupported_type: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
};

function formatEmailDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short' });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
        STATUS_BADGE[status] || 'bg-muted text-muted-foreground'
      )}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function EmailExtractionTable({
  results,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  showSelection = false,
  emptyMessage = 'Aún no hay documentos en esta extracción.',
}: Props) {
  const selectable = results.filter(
    (r) => r.import_status === 'imported' && r.document_id
  );
  const allSelected =
    showSelection &&
    selectable.length > 0 &&
    selectable.every((r) => selectedIds?.has(r.document_id!));

  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
            {showSelection ? (
              <th className="p-2">
                <input
                  type="checkbox"
                  checked={Boolean(allSelected)}
                  onChange={(e) => onToggleAll?.(e.target.checked)}
                  aria-label="Seleccionar todos"
                />
              </th>
            ) : null}
            <th className="p-2">Asunto del correo</th>
            <th className="p-2">Fecha correo</th>
            <th className="p-2">Tipo</th>
            <th className="p-2">Fec. emi</th>
            <th className="p-2">Código</th>
            <th className="p-2">Emisor</th>
            <th className="p-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {!results.length ? (
            <tr>
              <td
                colSpan={showSelection ? 8 : 7}
                className="p-6 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            results.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border/40 align-top transition-colors"
              >
                {showSelection ? (
                  <td className="p-2">
                    {row.import_status === 'imported' && row.document_id ? (
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(row.document_id) ?? false}
                        onChange={() => onToggleSelect?.(row.document_id!)}
                        aria-label={`Seleccionar ${row.codigo_generacion || row.file_name}`}
                      />
                    ) : null}
                  </td>
                ) : null}
                <td className="max-w-[14rem] p-2 break-words">
                  {row.email_subject || '—'}
                </td>
                <td className="whitespace-nowrap p-2">{formatEmailDate(row.email_date)}</td>
                <td className="whitespace-nowrap p-2">
                  {row.tipo_dte_label || row.tipo_dte || '—'}
                </td>
                <td className="whitespace-nowrap p-2">{row.fec_emi || '—'}</td>
                <td className="p-2 font-mono text-xs">{row.codigo_generacion || '—'}</td>
                <td className="max-w-[10rem] p-2 break-words">
                  {row.emisor_nombre || '—'}
                </td>
                <td className="whitespace-nowrap p-2">
                  <StatusBadge status={row.import_status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function mergeSyncJobResults(
  prev: EmailSyncJobResultRow[],
  batch: EmailSyncJobResultRow[]
): EmailSyncJobResultRow[] {
  const map = new Map(
    prev.map((row) => [`${row.message_uid}:${row.attachment_part_id}`, row])
  );
  for (const row of batch) {
    map.set(`${row.message_uid}:${row.attachment_part_id}`, row);
  }
  return Array.from(map.values());
}
