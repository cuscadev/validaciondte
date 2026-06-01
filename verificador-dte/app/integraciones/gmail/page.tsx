'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, ShieldCheck, Unplug, X } from 'lucide-react';
import { toast } from 'sonner';

import GmailDocumentFilters, {
  type GmailCatalogFilters,
} from '@/components/gmail/GmailDocumentFilters';
import GmailDocumentTable, { STATUS_LABELS } from '@/components/gmail/GmailDocumentTable';
import GmailJsonVerifyPanel from '@/components/gmail/GmailJsonVerifyPanel';
import PlanGate from '@/components/PlanGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { auth } from '@/lib/firebase';
import { GMAIL_OAUTH_ERROR_MESSAGES } from '@/lib/gmail/callback-errors';
import type { GmailJsonVerifyResult } from '@/lib/gmail/json-verify-result';
import type { GmailDocumentRow } from '@/lib/supabase-admin';

type GmailStatus = {
  connected: boolean;
  googleEmail: string | null;
  connectedAt: string | null;
  lastSync: {
    id: string;
    status: string;
    dateFrom: string;
    dateTo: string;
    importedCount: number;
  } | null;
};

type SyncJob = {
  id: string;
  status: string;
  found_count: number;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  date_from: string;
  date_to: string;
};

type LinkedPreview = {
  doc: GmailDocumentRow;
  links: Array<{ link_type: string; source_document_id: string; target_document_id: string }>;
  documents: GmailDocumentRow[];
};

async function authFetch(url: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Inicia sesion para continuar.');
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function buildCatalogQuery(filters: GmailCatalogFilters) {
  const params = new URLSearchParams();
  params.set('importStatus', 'imported');
  params.set('limit', '100');
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.tipoDte) params.set('tipoDte', filters.tipoDte);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  return params.toString();
}

export default function GmailIntegracionPage() {
  const defaults = useMemo(() => defaultDateRange(), []);
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [syncing, setSyncing] = useState(false);
  const [job, setJob] = useState<SyncJob | null>(null);
  const [catalogFilters, setCatalogFilters] = useState<GmailCatalogFilters>({
    q: '',
    tipoDte: '',
    dateFrom: '',
    dateTo: '',
  });
  const [catalog, setCatalog] = useState<GmailDocumentRow[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [linkedPreview, setLinkedPreview] = useState<LinkedPreview | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResults, setVerifyResults] = useState<GmailJsonVerifyResult[]>([]);
  const [verifyDownloadHref, setVerifyDownloadHref] = useState<string | null>(null);
  const [verifyFilename, setVerifyFilename] = useState('verificacion_gmail_json.xlsx');

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await authFetch('/api/integrations/gmail/status');
      const json = (await res.json()) as GmailStatus & { error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar el estado.');
      setStatus(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const qs = buildCatalogQuery(catalogFilters);
      const res = await authFetch(`/api/integrations/gmail/documents?${qs}`);
      const json = (await res.json()) as {
        documents?: GmailDocumentRow[];
        total?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar el catalogo.');
      setCatalog(json.documents || []);
      setCatalogTotal(json.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoadingCatalog(false);
    }
  }, [catalogFilters]);

  useEffect(() => {
    loadStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      toast.success('Gmail conectado correctamente.');
      window.history.replaceState({}, '', '/integraciones/gmail');
    }
    const err = params.get('error');
    if (err) {
      const msg = GMAIL_OAUTH_ERROR_MESSAGES[err] || decodeURIComponent(err);
      toast.error(msg);
      window.history.replaceState({}, '', '/integraciones/gmail');
    }
  }, [loadStatus]);

  useEffect(() => {
    if (!status?.connected) return;
    const timer = window.setTimeout(() => {
      void loadCatalog();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [status?.connected, catalogFilters, loadCatalog]);

  const connectGmail = async () => {
    try {
      const res = await authFetch('/api/integrations/gmail/connect', {
        method: 'POST',
        body: JSON.stringify({ returnOrigin: window.location.origin }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || 'No se pudo iniciar OAuth.');
      window.location.href = json.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  const disconnectGmail = async () => {
    try {
      const res = await authFetch('/api/integrations/gmail/status', {
        method: 'DELETE',
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudo desconectar.');
      toast.success('Gmail desconectado.');
      setJob(null);
      setCatalog([]);
      setSelectedIds(new Set());
      await loadStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  const runSync = async () => {
    if (!dateFrom || !dateTo) {
      toast.warning('Indica fecha desde y hasta.');
      return;
    }
    if (dateFrom > dateTo) {
      toast.warning('La fecha inicial no puede ser mayor que la final.');
      return;
    }

    setSyncing(true);
    setJob(null);
    setSelectedIds(new Set());

    try {
      let currentJob: SyncJob | null = null;
      let jobId: string | undefined;

      do {
        const res = await authFetch('/api/integrations/gmail/sync', {
          method: 'POST',
          body: JSON.stringify(jobId ? { jobId } : { dateFrom, dateTo }),
        });
        const json = (await res.json()) as {
          job?: SyncJob;
          error?: string;
        };
        if (!res.ok || !json.job) {
          throw new Error(json.error || 'Error en sincronizacion.');
        }

        currentJob = json.job;
        jobId = json.job.id;
        setJob(json.job);
      } while (currentJob?.status === 'running');

      if (currentJob) {
        await loadCatalog();
        toast.success(
          `Sync finalizado: ${currentJob.imported_count} importados, ${currentJob.skipped_count} omitidos.`
        );
      }
      await loadStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setSyncing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(
      new Set(catalog.filter((d) => d.import_status === 'imported').map((d) => d.id))
    );
  };

  const viewJson = async (doc: GmailDocumentRow) => {
    try {
      const res = await authFetch(`/api/integrations/gmail/documents/${doc.id}`);
      const json = (await res.json()) as { jsonUrl?: string | null; error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudo abrir el JSON.');
      if (!json.jsonUrl) {
        toast.warning('Este documento no tiene archivo en almacenamiento.');
        return;
      }
      window.open(json.jsonUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  const viewLinks = async (doc: GmailDocumentRow) => {
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
  };

  const verifySelected = async () => {
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
        setVerifyFilename(exportJson.filename || 'verificacion_gmail_json.xlsx');
        if (exportJson.downloadUrl) {
          setVerifyDownloadHref(exportJson.downloadUrl);
        } else if (exportJson.excelBase64) {
          setVerifyDownloadHref(
            `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${exportJson.excelBase64}`
          );
        }
      }

      toast.success(
        `Verificacion JSON completada: ${json.resultados.length} resultado(s) desde Gmail.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setVerifyLoading(false);
    }
  };

  const progressValue = job
    ? job.status === 'completed'
      ? 100
      : Math.min(
          95,
          Math.round(
            ((job.imported_count + job.skipped_count + job.error_count) /
              Math.max(job.found_count, 1)) *
              100
          )
        )
    : 0;

  return (
    <PlanGate routeKey="integraciones-gmail">
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar DTE desde Gmail</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conecta Gmail (solo lectura), importa adjuntos JSON de tipos tributarios relevantes
            (01, 03, 05, 06, 11, 14) y verifica en Hacienda usando el mismo flujo que Verificar JSON.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-4" />
              Conexion Gmail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingStatus ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Cargando estado...
              </div>
            ) : status?.connected ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{status.googleEmail}</p>
                  <p className="text-xs text-muted-foreground">
                    Conectado · acceso de solo lectura a Gmail
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={disconnectGmail}>
                  <Unplug className="mr-2 size-4" />
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Aun no has autorizado el acceso a Gmail para esta organizacion.
                </p>
                <Button type="button" onClick={connectGmail}>
                  Conectar Gmail
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buscar e importar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date-from">Correo desde</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  disabled={!status?.connected || syncing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-to">Correo hasta</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  disabled={!status?.connected || syncing}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Se buscan correos con adjuntos JSON. Solo se importan DTE 01, 03, 05, 06, 11 y 14;
              otros tipos quedan como{' '}
              <span className="font-medium">{STATUS_LABELS.skipped_unsupported_type}</span>.
              Se filtra por <code className="text-[11px]">identificacion.fecEmi</code> dentro del
              rango indicado.
            </p>
            <Button type="button" onClick={runSync} disabled={!status?.connected || syncing}>
              {syncing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                'Buscar e importar'
              )}
            </Button>

            {job && (
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex flex-wrap gap-3 text-sm">
                  <span>
                    Encontrados: <strong>{job.found_count}</strong>
                  </span>
                  <span>
                    Importados: <strong>{job.imported_count}</strong>
                  </span>
                  <span>
                    Omitidos: <strong>{job.skipped_count}</strong>
                  </span>
                  <span>
                    Errores: <strong>{job.error_count}</strong>
                  </span>
                  <span className="text-muted-foreground">Estado: {job.status}</span>
                </div>
                <Progress value={progressValue} />
              </div>
            )}
          </CardContent>
        </Card>

        {status?.connected && (
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Catalogo de DTE importados</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {catalogTotal} documento(s)
                  {job ? ` · ultimo sync ${job.date_from} — ${job.date_to}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingCatalog}
                  onClick={() => void loadCatalog()}
                >
                  {loadingCatalog ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Actualizar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedIds.size || verifyLoading}
                  onClick={() => void verifySelected()}
                >
                  {verifyLoading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 size-4" />
                  )}
                  Verificar JSON ({selectedIds.size})
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <GmailDocumentFilters
                filters={catalogFilters}
                onChange={(patch) => setCatalogFilters((prev) => ({ ...prev, ...patch }))}
                disabled={loadingCatalog}
              />

              {loadingCatalog && !catalog.length ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando catalogo...
                </div>
              ) : catalog.length ? (
                <GmailDocumentTable
                  documents={catalog}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onToggleAll={toggleAll}
                  onViewLinks={(doc) => void viewLinks(doc)}
                  onViewJson={(doc) => void viewJson(doc)}
                />
              ) : (
                <p className="py-6 text-sm text-muted-foreground">
                  No hay documentos importados con estos filtros. Ejecuta una sincronizacion o
                  amplia el rango de fechas.
                </p>
              )}

              <GmailJsonVerifyPanel
                results={verifyResults}
                downloadHref={verifyDownloadHref}
                filename={verifyFilename}
                loading={verifyLoading}
              />

              {linkedPreview && (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Documentos relacionados</p>
                      <p className="text-xs text-muted-foreground">
                        {linkedPreview.doc.tipo_dte_label} ·{' '}
                        {linkedPreview.doc.codigo_generacion}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setLinkedPreview(null)}
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
                          className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/40 px-3 py-2"
                        >
                          <div>
                            <span className="font-medium">
                              {rel.tipo_dte_label || rel.tipo_dte}
                            </span>
                            <span className="mx-2 text-muted-foreground">·</span>
                            <span className="font-mono text-xs">{rel.codigo_generacion}</span>
                            <div className="text-xs text-muted-foreground">
                              {rel.fec_emi} · {rel.emisor_nombre || '—'}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void viewLinks(rel)}
                          >
                            Ver enlaces
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin documentos vinculados.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </PlanGate>
  );
}
