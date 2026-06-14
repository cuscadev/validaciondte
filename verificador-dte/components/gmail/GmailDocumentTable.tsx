'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileJson,
  Link2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { EmailDocumentSortBy, EmailDocumentSortDir } from '@/lib/email-import/documents-api';
import { buildHaciendaPublicUrl } from '@/lib/gmail/hacienda-url';
import type { GmailDocumentRow } from '@/lib/gmail/types';
import { cn } from '@/lib/utils';

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
    'bg-primary/15 text-primary bg-primary/15 text-primary',
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
  sortBy: EmailDocumentSortBy;
  sortDir: EmailDocumentSortDir;
  onSort: (column: EmailDocumentSortBy) => void;
  showMailboxColumn?: boolean;
  loading?: boolean;
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

function SortableHead({
  label,
  sortKey,
  activeSort,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: EmailDocumentSortBy;
  activeSort: EmailDocumentSortBy;
  sortDir: EmailDocumentSortDir;
  onSort: (column: EmailDocumentSortBy) => void;
  className?: string;
}) {
  const active = activeSort === sortKey;
  return (
    <TableHead className={cn('px-3 py-3', className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white"
      >
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )
        ) : null}
      </button>
    </TableHead>
  );
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Codigo copiado');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  return (
    <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => void copy()}>
      <Copy className="mr-1 size-3" />
      {copied ? 'Copiado' : 'Copiar'}
    </Button>
  );
}

export default function GmailDocumentTable({
  documents,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onViewLinks,
  onViewJson,
  sortBy,
  sortDir,
  onSort,
  showMailboxColumn = false,
  loading = false,
}: Props) {
  const allSelected =
    documents.length > 0 && documents.every((d) => selectedIds.has(d.id));

  return (
    <div className="relative overflow-hidden rounded-xl border border-border">
      {loading && documents.length > 0 ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : null}

      <div
        className={cn(
          'overflow-x-auto',
          loading && documents.length > 0 && 'pointer-events-none opacity-60'
        )}
      >
        <Table className="min-w-[56rem] text-sm">
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50 hover:bg-slate-50 dark:border-white/10 dark:bg-zinc-900/60">
              <TableHead className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  aria-label="Seleccionar todos"
                  className="size-4 rounded border-slate-300"
                />
              </TableHead>
              <SortableHead
                label="Asunto"
                sortKey="email_subject"
                activeSort={sortBy}
                sortDir={sortDir}
                onSort={onSort}
                className="min-w-[10rem]"
              />
              <TableHead className="min-w-[8rem] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                De
              </TableHead>
              <SortableHead
                label="Fecha correo"
                sortKey="email_date"
                activeSort={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableHead
                label="Tipo DTE"
                sortKey="tipo_dte"
                activeSort={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableHead
                label="Fec. emision"
                sortKey="fec_emi"
                activeSort={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableHead
                label="Emisor"
                sortKey="emisor_nombre"
                activeSort={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableHead
                label="Codigo"
                sortKey="codigo_generacion"
                activeSort={sortBy}
                sortDir={sortDir}
                onSort={onSort}
                className="min-w-[9rem]"
              />
              <SortableHead
                label="Total"
                sortKey="monto_total"
                activeSort={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              />
              {showMailboxColumn ? (
                <TableHead className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  Buzon
                </TableHead>
              ) : null}
              <TableHead className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Enlaces
              </TableHead>
              <TableHead className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => {
              const haciendaUrl =
                doc.codigo_generacion && doc.fec_emi
                  ? buildHaciendaPublicUrl({
                      ambiente: doc.ambiente,
                      codigoGeneracion: doc.codigo_generacion,
                      fecEmi: doc.fec_emi,
                    })
                  : null;

              return (
                <TableRow key={doc.id} className="align-top">
                  <TableCell className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(doc.id)}
                      onChange={() => onToggleSelect(doc.id)}
                      disabled={doc.import_status !== 'imported'}
                      aria-label={`Seleccionar ${doc.file_name}`}
                      className="size-4 rounded border-slate-300"
                    />
                  </TableCell>
                  <TableCell className="max-w-[14rem] px-3 py-3 whitespace-normal">
                    <div
                      className="line-clamp-2 font-medium text-slate-900 dark:text-white"
                      title={doc.email_subject || undefined}
                    >
                      {doc.email_subject || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[10rem] px-3 py-3 whitespace-normal">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {doc.email_from_name || doc.email_from || '—'}
                    </div>
                    {doc.email_from_name && doc.email_from ? (
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                        {doc.email_from}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-3 py-3 whitespace-nowrap text-slate-700 dark:text-zinc-200">
                    {formatEmailDate(doc.email_date)}
                  </TableCell>
                  <TableCell className="px-3 py-3 whitespace-normal">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {doc.tipo_dte_label || doc.tipo_dte || '—'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      {doc.numero_control || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 whitespace-nowrap">{doc.fec_emi || '—'}</TableCell>
                  <TableCell className="max-w-[10rem] px-3 py-3 whitespace-normal">
                    <div className="font-medium">{doc.emisor_nombre || '—'}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      {[doc.emisor_nit, doc.emisor_nrc].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 whitespace-normal">
                    <div className="break-all font-mono text-xs text-slate-700 dark:text-zinc-200">
                      {doc.codigo_generacion || '—'}
                    </div>
                    {doc.codigo_generacion ? (
                      <CopyCodeButton code={doc.codigo_generacion} />
                    ) : null}
                  </TableCell>
                  <TableCell className="px-3 py-3 font-medium whitespace-nowrap">
                    {money(doc.monto_total)}
                  </TableCell>
                  {showMailboxColumn ? (
                    <TableCell className="max-w-[10rem] px-3 py-3 whitespace-normal">
                      <div className="text-xs font-medium text-slate-700 dark:text-zinc-200">
                        {doc.mailbox_email || '—'}
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                        {doc.source === 'imap' ? 'IMAP' : 'Gmail'}
                      </div>
                    </TableCell>
                  ) : null}
                  <TableCell className="px-3 py-3">
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
                  </TableCell>
                  <TableCell className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {haciendaUrl ? (
                        <Button type="button" size="sm" variant="outline" asChild>
                          <a href={haciendaUrl} target="_blank" rel="noreferrer" title="Ver en MH">
                            <ExternalLink className="size-3 sm:mr-1" />
                            <span className="hidden sm:inline">MH</span>
                          </a>
                        </Button>
                      ) : null}
                      {doc.storage_path ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onViewJson(doc)}
                          title="Ver JSON"
                        >
                          <FileJson className="size-3 sm:mr-1" />
                          <span className="hidden sm:inline">JSON</span>
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
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
