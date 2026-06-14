'use client';

import { useEffect, useState } from 'react';
import { FileStack, Loader2, ShieldCheck, X } from 'lucide-react';

import EmailDocumentTablePagination, {
  EMAIL_DOCUMENT_PAGE_SIZES,
} from '@/components/gmail/EmailDocumentTablePagination';
import GmailDocumentTable from '@/components/gmail/GmailDocumentTable';
import GmailJsonVerifyPanel from '@/components/gmail/GmailJsonVerifyPanel';
import { Button } from '@/components/ui/button';
import type { LinkedPreview } from '@/lib/email-import/use-email-document-catalog';
import type { EmailDocumentSortBy, EmailDocumentSortDir } from '@/lib/email-import/documents-api';
import type { GmailJsonVerifyResult } from '@/lib/gmail/json-verify-result';
import type { GmailDocumentRow } from '@/lib/gmail/types';

type TabId = 'catalog' | 'hacienda';

type Props = {
  catalog: GmailDocumentRow[];
  catalogTotal: number;
  loadingCatalog: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  sortBy: EmailDocumentSortBy;
  sortDir: EmailDocumentSortDir;
  onSort: (column: EmailDocumentSortBy) => void;
  showMailboxColumn: boolean;
  onViewLinks: (doc: GmailDocumentRow) => void;
  onViewJson: (doc: GmailDocumentRow) => void;
  emptyCatalogTitle?: string;
  emptyCatalogDescription?: string;
  verifyResults: GmailJsonVerifyResult[];
  verifyDownloadHref: string | null;
  verifyFilename: string;
  verifyLoading: boolean;
  linkedPreview: LinkedPreview | null;
  onCloseLinkedPreview: () => void;
  loadingLinks: boolean;
  onViewLinksFromPreview: (doc: GmailDocumentRow) => void;
};

export default function EmailDocumentResultsTabs({
  catalog,
  catalogTotal,
  loadingCatalog,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  sortBy,
  sortDir,
  onSort,
  showMailboxColumn,
  onViewLinks,
  onViewJson,
  emptyCatalogTitle = 'Sin documentos importados',
  emptyCatalogDescription = 'Ejecuta una sincronizacion o amplia el rango de fechas del buzon.',
  verifyResults,
  verifyDownloadHref,
  verifyFilename,
  verifyLoading,
  linkedPreview,
  onCloseLinkedPreview,
  loadingLinks,
  onViewLinksFromPreview,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('catalog');

  useEffect(() => {
    if (verifyLoading) {
      setActiveTab('hacienda');
      return;
    }
    if (verifyResults.length > 0) {
      setActiveTab('hacienda');
    }
  }, [verifyLoading, verifyResults.length]);

  const haciendaCount = verifyResults.length;
  const tabs: { id: TabId; label: string; count?: number | null }[] = [
    { id: 'catalog', label: 'Correos importados', count: catalogTotal },
    {
      id: 'hacienda',
      label: 'Verificacion Hacienda',
      count: verifyLoading ? null : haciendaCount,
    },
  ];

  return (
    <div className="space-y-0">
      <div
        className="flex gap-1 overflow-x-auto border-b border-border"
        role="tablist"
        aria-label="Resultados de importacion"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.id === 'hacienda' ? (
                <ShieldCheck className="size-4 shrink-0" />
              ) : (
                <FileStack className="size-4 shrink-0" />
              )}
              {tab.label}
              {tab.count != null ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              ) : verifyLoading && tab.id === 'hacienda' ? (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="pt-5" role="tabpanel">
        {activeTab === 'catalog' ? (
          <div className="space-y-5">
            {loadingCatalog && !catalog.length ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Cargando catalogo...
              </div>
            ) : catalog.length ? (
              <>
                <GmailDocumentTable
                  documents={catalog}
                  selectedIds={selectedIds}
                  onToggleSelect={onToggleSelect}
                  onToggleAll={onToggleAll}
                  onViewLinks={onViewLinks}
                  onViewJson={onViewJson}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  showMailboxColumn={showMailboxColumn}
                  loading={loadingCatalog}
                />
                <EmailDocumentTablePagination
                  page={page}
                  pageSize={pageSize}
                  total={catalogTotal}
                  totalPages={totalPages}
                  loading={loadingCatalog}
                  onPageChange={onPageChange}
                  onPageSizeChange={onPageSizeChange}
                />
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center dark:border-white/10 dark:bg-zinc-900/30">
                <FileStack className="mx-auto mb-3 size-8 text-slate-400" />
                <p className="font-medium text-slate-900 dark:text-white">{emptyCatalogTitle}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {emptyCatalogDescription}
                </p>
              </div>
            )}

            {linkedPreview ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-zinc-900/40">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">Documentos relacionados</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {linkedPreview.doc.tipo_dte_label} · {linkedPreview.doc.codigo_generacion}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={onCloseLinkedPreview}
                    aria-label="Cerrar panel"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                {loadingLinks ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : linkedPreview.documents.length ? (
                  <ul className="space-y-2 text-sm">
                    {linkedPreview.documents.map((rel) => (
                      <li
                        key={rel.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-zinc-950"
                      >
                        <div>
                          <span className="font-medium">{rel.tipo_dte_label || rel.tipo_dte}</span>
                          <span className="mx-2 text-slate-400">·</span>
                          <span className="font-mono text-xs">{rel.codigo_generacion}</span>
                          <div className="text-xs text-slate-500 dark:text-zinc-400">
                            {rel.fec_emi} · {rel.emisor_nombre || '—'}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onViewLinksFromPreview(rel)}
                        >
                          Ver enlaces
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin documentos vinculados.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {verifyLoading || haciendaCount > 0 ? (
              <GmailJsonVerifyPanel
                results={verifyResults}
                downloadHref={verifyDownloadHref}
                filename={verifyFilename}
                loading={verifyLoading}
                embedded
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center dark:border-white/10 dark:bg-zinc-900/30">
                <ShieldCheck className="mx-auto mb-3 size-8 text-slate-400" />
                <p className="font-medium text-slate-900 dark:text-white">
                  Sin verificaciones en Hacienda
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Selecciona documentos en la pestana Correos importados y pulsa Verificar JSON.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { EMAIL_DOCUMENT_PAGE_SIZES };
