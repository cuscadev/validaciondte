'use client';

import { useCallback, useEffect, useState } from 'react';
import { Inbox, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { TABLE_HEAD_STICKY } from '@/lib/ui/table-classes';
import { auth } from '@/lib/firebase';
import type { GmailDocumentRow } from '@/lib/gmail/types';

type Props = {
  /** Tipos de DTE permitidos por la pagina (ej. ['01','03','05']). Vacio = todos. */
  tiposDte?: string[];
  onImport: (files: File[]) => void;
  disabled?: boolean;
};

async function authFetch(url: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Inicia sesion para continuar.');
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

function sanitizeFileName(doc: GmailDocumentRow): string {
  const raw = (doc.file_name || '').split(/[\\/]/).pop() || '';
  const base = raw || `${doc.codigo_generacion || doc.id}.json`;
  return base.toLowerCase().endsWith('.json') ? base : `${base}.json`;
}

const SOURCE_LABELS: Record<string, string> = {
  gmail: 'Gmail',
  imap: 'IMAP',
};

export default function ImportFromMailButton({ tiposDte, onImport, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [documents, setDocuments] = useState<GmailDocumentRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('importStatus', 'imported');
      params.set('limit', '200');
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await authFetch(`/api/integrations/gmail/documents?${params.toString()}`);
      const json = (await res.json()) as { documents?: GmailDocumentRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar el catalogo de correo.');

      let rows = json.documents || [];
      if (tiposDte?.length) {
        const allowed = new Set(tiposDte);
        rows = rows.filter((doc) => allowed.has(String(doc.tipo_dte || '')));
      }
      setDocuments(rows);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, tiposDte]);

  useEffect(() => {
    if (!open) return;
    void loadDocuments();
  }, [open, loadDocuments]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === documents.length ? new Set() : new Set(documents.map((d) => d.id))
    );
  };

  const importSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast.warning('Selecciona al menos un documento.');
      return;
    }

    setImporting(true);
    try {
      const files: File[] = [];
      for (const id of ids) {
        const doc = documents.find((d) => d.id === id);
        if (!doc) continue;
        const res = await authFetch(`/api/integrations/gmail/documents/${id}/raw`);
        if (!res.ok) {
          toast.error(`No se pudo descargar ${sanitizeFileName(doc)}.`);
          continue;
        }
        const blob = await res.blob();
        files.push(new File([blob], sanitizeFileName(doc), { type: 'application/json' }));
      }

      if (!files.length) {
        throw new Error('No se pudo descargar ningun documento.');
      }

      onImport(files);
      toast.success(`${files.length} archivo(s) agregados desde el correo.`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Mail className="mr-2 size-4" />
        Importar desde correo
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} className="w-[min(56rem,95vw)]">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold">Importar JSON desde correo</h3>
            <p className="text-sm text-muted-foreground">
              Documentos sincronizados desde Gmail o IMAP.
              {tiposDte?.length ? ` Solo tipos DTE ${tiposDte.join(', ')}.` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="mail-import-from" className="text-xs">
                Fecha emision desde
              </Label>
              <Input
                id="mail-import-from"
                type="date"
                className="h-9"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mail-import-to" className="text-xs">
                Fecha emision hasta
              </Label>
              <Input
                id="mail-import-to"
                type="date"
                className="h-9"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void loadDocuments()}
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Actualizar
            </Button>
          </div>

          <div className="max-h-[50vh] overflow-auto rounded-lg border border-border">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Cargando documentos...
              </div>
            ) : documents.length ? (
              <table className="w-full text-sm">
                <thead className={`${TABLE_HEAD_STICKY} text-left text-xs uppercase tracking-wide text-muted-foreground`}>
                  <tr>
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={documents.length > 0 && selectedIds.size === documents.length}
                        onChange={toggleAll}
                        aria-label="Seleccionar todos"
                      />
                    </th>
                    <th className="px-3 py-2">Archivo</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Fecha emision</th>
                    <th className="px-3 py-2">Emisor</th>
                    <th className="px-3 py-2">Buzon</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="cursor-pointer border-t border-border hover:bg-muted/40"
                      onClick={() => toggle(doc.id)}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => toggle(doc.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Seleccionar ${sanitizeFileName(doc)}`}
                        />
                      </td>
                      <td className="max-w-[16rem] truncate px-3 py-2 font-mono text-xs">
                        {sanitizeFileName(doc)}
                      </td>
                      <td className="px-3 py-2">{doc.tipo_dte_label || doc.tipo_dte || '—'}</td>
                      <td className="px-3 py-2">{doc.fec_emi || '—'}</td>
                      <td className="max-w-[14rem] truncate px-3 py-2">
                        {doc.emisor_nombre || '—'}
                      </td>
                      <td className="max-w-[12rem] truncate px-3 py-2">
                        <span className="text-xs">{doc.mailbox_email || '—'}</span>
                        <span className="ml-1 text-[10px] uppercase text-slate-400">
                          {SOURCE_LABELS[doc.source || 'gmail'] || doc.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
                <Inbox className="size-6 text-slate-400" />
                <p>No hay documentos importados desde el correo para estos filtros.</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Sincroniza tu buzon en Integraciones (Gmail o Correo IMAP) y vuelve a intentar.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {selectedIds.size} de {documents.length} seleccionados
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!selectedIds.size || importing}
                onClick={() => void importSelected()}
              >
                {importing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Agregar {selectedIds.size ? `(${selectedIds.size})` : ''}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
