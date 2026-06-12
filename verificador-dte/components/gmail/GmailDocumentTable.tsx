'use client';

import { ExternalLink, FileJson, Link2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { buildHaciendaPublicUrl } from '@/lib/gmail/hacienda-url';
import type { GmailDocumentRow } from '@/lib/gmail/types';

export const STATUS_LABELS: Record<string, string> = {
  imported: 'Importado',
  skipped_duplicate: 'Ya existia',
  skipped_date: 'Fuera de rango (fecEmi)',
  skipped_invalid: 'JSON invalido',
  skipped_unsupported_type: 'Tipo DTE no soportado',
};

const STATUS_STYLES: Record<string, string> = {
  imported:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  skipped_duplicate:
    'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200',
  skipped_date:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  skipped_invalid: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  skipped_unsupported_type:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
};

type Props = {
  documents: GmailDocumentRow[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onViewLinks: (doc: GmailDocumentRow) => void;
  onViewJson: (doc: GmailDocumentRow) => void;
};

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('es-SV', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatEmailDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-SV', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_STYLES[status] ||
        'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200'
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function GmailDocumentTable({
  documents,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onViewLinks,
  onViewJson,
}: Props) {
  const allSelected =
    documents.length > 0 && documents.every((d) => selectedIds.has(d.id));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[72rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-400">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  aria-label="Seleccionar todos"
                  className="size-4 rounded border-slate-300"
                />
              </th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Buzon</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Fec. Emi</th>
              <th className="px-4 py-3">Emisor</th>
              <th className="px-4 py-3">Codigo</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Enlaces</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc, index) => {
              const haciendaUrl =
                doc.codigo_generacion && doc.fec_emi
                  ? buildHaciendaPublicUrl({
                      ambiente: doc.ambiente,
                      codigoGeneracion: doc.codigo_generacion,
                      fecEmi: doc.fec_emi,
                    })
                  : null;
              return (
                <tr
                  key={doc.id}
                  className={`border-b border-slate-100 align-top transition hover:bg-slate-50/80 dark:border-white/5 dark:hover:bg-zinc-900/40 ${
                    index % 2 === 0 ? 'bg-white dark:bg-zinc-950' : 'bg-slate-50/40 dark:bg-zinc-950/60'
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(doc.id)}
                      onChange={() => onToggleSelect(doc.id)}
                      disabled={doc.import_status !== 'imported'}
                      aria-label={`Seleccionar ${doc.file_name}`}
                      className="size-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {doc.tipo_dte_label || doc.tipo_dte || '—'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      {doc.numero_control || '—'}
                    </div>
                  </td>
                  <td className="max-w-[12rem] px-4 py-3 break-words">
                    <div className="text-xs font-medium text-slate-700 dark:text-zinc-200">
                      {doc.mailbox_email || '—'}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                      {doc.source === 'imap' ? 'IMAP' : 'Gmail'}
                    </div>
                  </td>
                  <td className="max-w-[14rem] px-4 py-3 break-words">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {doc.email_from_name || doc.email_from || '—'}
                    </div>
                    {doc.email_from_name ? (
                      <div className="text-xs text-slate-500 dark:text-zinc-400">
                        {doc.email_from}
                      </div>
                    ) : null}
                    <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      {formatEmailDate(doc.email_date)}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-zinc-300">
                      {doc.email_subject || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{doc.fec_emi || '—'}</td>
                  <td className="max-w-[10rem] px-4 py-3 break-words">
                    <div className="font-medium">{doc.emisor_nombre || '—'}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      {[doc.emisor_nit, doc.emisor_nrc].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-zinc-200">
                    {doc.codigo_generacion || '—'}
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {money(doc.monto_total)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.import_status} />
                  </td>
                  <td className="px-4 py-3">
                    {(doc.linked_count || 0) > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onViewLinks(doc)}
                      >
                        <Link2 className="mr-1 size-3" />
                        {doc.linked_count}
                      </Button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {haciendaUrl ? (
                        <Button type="button" size="sm" variant="outline" asChild>
                          <a href={haciendaUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1 size-3" />
                            MH
                          </a>
                        </Button>
                      ) : null}
                      {doc.storage_path ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onViewJson(doc)}
                        >
                          <FileJson className="mr-1 size-3" />
                          JSON
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
