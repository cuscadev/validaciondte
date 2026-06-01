'use client';

import { ExternalLink, FileJson, Link2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { buildHaciendaPublicUrl } from '@/lib/gmail/hacienda-url';
import type { GmailDocumentRow } from '@/lib/supabase-admin';

export const STATUS_LABELS: Record<string, string> = {
  imported: 'Importado',
  skipped_duplicate: 'Ya existia',
  skipped_date: 'Fuera de rango (fecEmi)',
  skipped_invalid: 'JSON invalido',
  skipped_unsupported_type: 'Tipo DTE no soportado',
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="p-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
                aria-label="Seleccionar todos"
              />
            </th>
            <th className="p-2">Tipo</th>
            <th className="p-2">Fec. Emi</th>
            <th className="p-2">Emisor</th>
            <th className="p-2">Codigo</th>
            <th className="p-2">Total</th>
            <th className="p-2">Estado</th>
            <th className="p-2">Enlaces</th>
            <th className="p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
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
              <tr key={doc.id} className="border-b border-border/40 align-top">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(doc.id)}
                    onChange={() => onToggleSelect(doc.id)}
                    disabled={doc.import_status !== 'imported'}
                    aria-label={`Seleccionar ${doc.file_name}`}
                  />
                </td>
                <td className="p-2">
                  <div className="font-medium">{doc.tipo_dte_label || doc.tipo_dte || '—'}</div>
                  <div className="text-xs text-muted-foreground">{doc.numero_control || '—'}</div>
                </td>
                <td className="p-2">{doc.fec_emi || '—'}</td>
                <td className="max-w-[10rem] p-2 break-words">
                  <div>{doc.emisor_nombre || '—'}</div>
                  <div className="text-xs text-muted-foreground">
                    {[doc.emisor_nit, doc.emisor_nrc].filter(Boolean).join(' · ') || '—'}
                  </div>
                </td>
                <td className="p-2 font-mono text-xs">{doc.codigo_generacion || '—'}</td>
                <td className="p-2">{money(doc.monto_total)}</td>
                <td className="p-2">
                  {STATUS_LABELS[doc.import_status] || doc.import_status}
                </td>
                <td className="p-2">
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
                    '—'
                  )}
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {haciendaUrl && (
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href={haciendaUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 size-3" />
                          MH
                        </a>
                      </Button>
                    )}
                    {doc.storage_path && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onViewJson(doc)}
                      >
                        <FileJson className="mr-1 size-3" />
                        JSON
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
