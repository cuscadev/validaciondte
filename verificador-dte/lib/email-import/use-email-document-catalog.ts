'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { GmailCatalogFilters } from '@/components/gmail/GmailDocumentFilters';
import { useAuth } from '@/components/AuthProvider';
import { authFetch } from '@/lib/email-import/auth-fetch';
import type { EmailDocumentSortBy, EmailDocumentSortDir } from '@/lib/email-import/documents-api';
import {
  catalogQueryParams,
  emailDocumentCatalogKeys,
  type EmailCatalogSource,
} from '@/lib/email-import/query-keys';
import { createGetQueryOptions } from '@/lib/tanstack-query';
import type { GmailJsonVerifyResult } from '@/lib/gmail/json-verify-result';
import type { GmailDocumentRow } from '@/lib/gmail/types';

export { authFetch } from '@/lib/email-import/auth-fetch';

export const DEFAULT_CATALOG_PAGE_SIZE = 10;

export type LinkedPreview = {
  doc: GmailDocumentRow;
  links: Array<{ link_type: string; source_document_id: string; target_document_id: string }>;
  documents: GmailDocumentRow[];
};

type CatalogResponse = {
  documents?: GmailDocumentRow[];
  total?: number;
};

type UseEmailDocumentCatalogOptions = {
  enabled: boolean;
  sourceFilter?: 'imap';
  connectedEmail?: string | null;
  verifyExportFilename?: string;
  verifySuccessLabel?: string;
};

export function useEmailDocumentCatalog(options: UseEmailDocumentCatalogOptions) {
  const {
    enabled,
    sourceFilter,
    connectedEmail,
    verifyExportFilename = 'verificacion_json.xlsx',
    verifySuccessLabel = 'Verificacion JSON completada.',
  } = options;

  const { authChecked, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const catalogSource: EmailCatalogSource = sourceFilter ?? 'gmail';

  const [catalogFilters, setCatalogFilters] = useState<GmailCatalogFilters>({
    q: '',
    tipoDte: '',
    dateFrom: '',
    dateTo: '',
    mailbox: '',
  });
  const [debouncedFilters, setDebouncedFilters] = useState(catalogFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_CATALOG_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<EmailDocumentSortBy>('email_date');
  const [sortDir, setSortDir] = useState<EmailDocumentSortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [linkedPreview, setLinkedPreview] = useState<LinkedPreview | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResults, setVerifyResults] = useState<GmailJsonVerifyResult[]>([]);
  const [verifyDownloadHref, setVerifyDownloadHref] = useState<string | null>(null);
  const [verifyFilename, setVerifyFilename] = useState(verifyExportFilename);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFilters(catalogFilters);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [catalogFilters]);

  useEffect(() => {
    setPage(1);
  }, [catalogFilters, pageSize, sortBy, sortDir]);

  const listParams = useMemo(
    () => ({
      filters: debouncedFilters,
      page,
      pageSize,
      sortBy,
      sortDir,
      sourceFilter,
    }),
    [debouncedFilters, page, pageSize, sortBy, sortDir, sourceFilter]
  );

  const catalogQuery = useQuery({
    ...createGetQueryOptions<CatalogResponse>({
      queryKey: emailDocumentCatalogKeys.list(catalogSource, listParams),
      path: '/api/integrations/gmail/documents',
      params: catalogQueryParams(listParams),
      enabled: enabled && authChecked && isAuthenticated,
      oneShot: true,
    }),
    placeholderData: keepPreviousData,
    select: (data) => ({
      documents: data.documents || [],
      total: data.total ?? 0,
    }),
  });

  const catalog = catalogQuery.data?.documents ?? [];
  const catalogTotal = catalogQuery.data?.total ?? 0;
  const loadingCatalog = catalogQuery.isFetching;
  const totalPages = Math.max(1, Math.ceil(catalogTotal / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (catalogQuery.error) {
      toast.error(
        catalogQuery.error instanceof Error
          ? catalogQuery.error.message
          : 'No se pudo cargar el catalogo.'
      );
    }
  }, [catalogQuery.error]);

  const mailboxOptions = useMemo(() => {
    const seen = new Set<string>();
    if (connectedEmail) seen.add(connectedEmail);
    catalog.forEach((doc) => {
      if (doc.mailbox_email) seen.add(doc.mailbox_email);
    });
    if (catalogFilters.mailbox) seen.add(catalogFilters.mailbox);
    return Array.from(seen).sort();
  }, [catalog, catalogFilters.mailbox, connectedEmail]);

  const showMailboxColumn = mailboxOptions.length > 1;

  const loadCatalog = useCallback(async () => {
    await catalogQuery.refetch();
  }, [catalogQuery]);

  const refreshCatalog = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: emailDocumentCatalogKeys.all });
  }, [queryClient]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setSelectedIds(new Set());
        return;
      }
      setSelectedIds(
        new Set(catalog.filter((d) => d.import_status === 'imported').map((d) => d.id))
      );
    },
    [catalog]
  );

  const handleSort = useCallback(
    (column: EmailDocumentSortBy) => {
      if (sortBy === column) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(column);
        setSortDir('desc');
      }
    },
    [sortBy]
  );

  const clearCatalog = useCallback(() => {
    queryClient.removeQueries({ queryKey: emailDocumentCatalogKeys.all });
    setSelectedIds(new Set());
    setLinkedPreview(null);
    setVerifyResults([]);
    setVerifyDownloadHref(null);
  }, [queryClient]);

  const viewJson = useCallback(async (doc: GmailDocumentRow) => {
    try {
      const res = await authFetch(`/api/integrations/gmail/documents/${doc.id}`);
      const json = (await res.json()) as { jsonUrl?: string | null; error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudo abrir el JSON.');
      if (!json.jsonUrl) {
        toast.warning('Este documento no tiene archivo en almacenamiento.');
        return;
      }
      const rawRes = await authFetch(json.jsonUrl);
      if (!rawRes.ok) throw new Error('No se pudo abrir el JSON.');
      const blobUrl = URL.createObjectURL(await rawRes.blob());
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  }, []);

  const viewLinks = useCallback(async (doc: GmailDocumentRow) => {
    setLoadingLinks(true);
    try {
      const res = await authFetch(`/api/integrations/gmail/documents/${doc.id}/links`);
      const json = (await res.json()) as LinkedPreview & { error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudieron cargar enlaces.');
      setLinkedPreview({
        doc,
        links: json.links || [],
        documents: json.documents || [],
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoadingLinks(false);
    }
  }, []);

  const verifySelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast.warning('Selecciona al menos un documento importado.');
      return;
    }

    setVerifyLoading(true);
    setVerifyResults([]);
    setVerifyDownloadHref(null);

    try {
      const res = await authFetch('/api/integrations/gmail/documents/verify-json', {
        method: 'POST',
        body: JSON.stringify({ documentIds: ids }),
      });
      const json = (await res.json()) as {
        resultados?: GmailJsonVerifyResult[];
        processedCount?: number;
        error?: string;
      };
      if (!res.ok || !json.resultados?.length) {
        throw new Error(json.error || 'No se pudo verificar los JSON seleccionados.');
      }

      setVerifyResults(json.resultados);

      const exportRes = await fetch('/api/verificararchjson/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultados: json.resultados }),
      });
      if (exportRes.ok) {
        const exportJson = (await exportRes.json()) as {
          filename?: string;
          downloadUrl?: string;
          excelBase64?: string;
        };
        setVerifyFilename(exportJson.filename || verifyExportFilename);
        if (exportJson.downloadUrl) {
          setVerifyDownloadHref(exportJson.downloadUrl);
        } else if (exportJson.excelBase64) {
          setVerifyDownloadHref(
            `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${exportJson.excelBase64}`
          );
        }
      }

      toast.success(`${verifySuccessLabel} ${json.resultados.length} resultado(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setVerifyLoading(false);
    }
  }, [selectedIds, verifyExportFilename, verifySuccessLabel]);

  return {
    catalogFilters,
    setCatalogFilters,
    catalog,
    catalogTotal,
    loadingCatalog,
    loadCatalog,
    refreshCatalog,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    sortBy,
    sortDir,
    handleSort,
    selectedIds,
    setSelectedIds,
    toggleSelect,
    toggleAll,
    linkedPreview,
    setLinkedPreview,
    loadingLinks,
    verifyLoading,
    verifyResults,
    verifyDownloadHref,
    verifyFilename,
    mailboxOptions,
    showMailboxColumn,
    viewJson,
    viewLinks,
    verifySelected,
    clearCatalog,
  };
}
