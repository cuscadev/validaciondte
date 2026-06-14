'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  CheckCircle2,
  FileStack,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { toast } from 'sonner';

import GmailDocumentFilters from '@/components/gmail/GmailDocumentFilters';
import EmailDocumentResultsTabs from '@/components/gmail/EmailDocumentResultsTabs';
import { STATUS_LABELS } from '@/components/gmail/GmailDocumentTable';
import PlanGate from '@/components/PlanGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useEmailDocumentCatalog, authFetch } from '@/lib/email-import/use-email-document-catalog';
import {
  emailDocumentCatalogKeys,
  gmailIntegrationKeys,
} from '@/lib/email-import/query-keys';
import { useGmailIntegrationStatus } from '@/lib/email-import/use-gmail-integration-status';
import { notifySyncCompleted, SYNC_CATALOG_HELP } from '@/lib/email-import/sync-plan-messages';
import type { SyncPlanResult } from '@/lib/email-import/sync-plan';
import { invalidateGetQueries } from '@/lib/tanstack-query';
import { GMAIL_OAUTH_ERROR_MESSAGES } from '@/lib/gmail/callback-errors';

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

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-SV', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function GmailIntegracionPage() {
  const queryClient = useQueryClient();
  const defaults = useMemo(() => defaultDateRange(), []);
  const statusQuery = useGmailIntegrationStatus();
  const status = statusQuery.data ?? null;
  const loadingStatus = statusQuery.isLoading;
  const [gmailEmail, setGmailEmail] = useState('');
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [syncing, setSyncing] = useState(false);
  const [job, setJob] = useState<SyncJob | null>(null);

  const catalogState = useEmailDocumentCatalog({
    enabled: Boolean(status?.connected),
    connectedEmail: status?.googleEmail,
    verifyExportFilename: 'verificacion_gmail_json.xlsx',
    verifySuccessLabel: 'Verificacion JSON completada desde Gmail.',
  });

  const {
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
  } = catalogState;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      toast.success('Gmail conectado correctamente.');
      void invalidateGetQueries(queryClient, gmailIntegrationKeys.all);
      window.history.replaceState({}, '', '/integraciones/gmail');
    }
    const err = params.get('error');
    if (err) {
      const msg = GMAIL_OAUTH_ERROR_MESSAGES[err] || decodeURIComponent(err);
      toast.error(msg);
      window.history.replaceState({}, '', '/integraciones/gmail');
    }
  }, [queryClient]);

  useEffect(() => {
    if (statusQuery.error) {
      toast.error(
        statusQuery.error instanceof Error ? statusQuery.error.message : 'Error'
      );
    }
  }, [statusQuery.error]);

  const refreshIntegration = async () => {
    await invalidateGetQueries(queryClient, gmailIntegrationKeys.all);
    await invalidateGetQueries(queryClient, emailDocumentCatalogKeys.all);
  };

  const connectGmail = async () => {
    try {
      const email = gmailEmail.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast.warning('Ingresa el correo Gmail que deseas conectar.');
        return;
      }
      const res = await authFetch('/api/integrations/gmail/connect', {
        method: 'POST',
        body: JSON.stringify({ returnOrigin: window.location.origin, email }),
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
      clearCatalog();
      await refreshIntegration();
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
      let lastSyncPlan: SyncPlanResult | undefined;

      do {
        const res = await authFetch('/api/integrations/gmail/sync', {
          method: 'POST',
          body: JSON.stringify(jobId ? { jobId } : { dateFrom, dateTo }),
        });
        const json = (await res.json()) as {
          job?: SyncJob;
          syncPlan?: SyncPlanResult;
          error?: string;
        };
        if (!res.ok || !json.job) {
          throw new Error(json.error || 'Error en sincronizacion.');
        }

        if (json.syncPlan) lastSyncPlan = json.syncPlan;
        currentJob = json.job;
        jobId = json.job.id;
        setJob(json.job);
      } while (currentJob?.status === 'running');

      if (currentJob) {
        await refreshCatalog();
        notifySyncCompleted(lastSyncPlan, currentJob, toast);
      }
      await refreshIntegration();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setSyncing(false);
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

  const lastImported = status?.lastSync?.importedCount ?? job?.imported_count ?? 0;

  return (
    <PlanGate routeKey="integraciones-gmail">
      <main className="w-full max-w-full text-foreground">
        <div className="flex w-full flex-col gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6 border-border bg-card">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-primary text-primary">
                  <Mail className="size-4" />
                  Integracion Gmail
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                  Importar DTE desde correo
                </h1>
                <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base text-muted-foreground">
                  Conecta Gmail con acceso de solo lectura, importa adjuntos JSON de tipos
                  tributarios relevantes y verifica en Hacienda con el mismo flujo de Verificar
                  JSON.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-auto lg:shrink-0">
                <MetricCard
                  icon={CheckCircle2}
                  label="Estado"
                  value={status?.connected ? 'Conectado' : 'Pendiente'}
                  accent={Boolean(status?.connected)}
                />
                <MetricCard
                  icon={FileStack}
                  label="En catalogo"
                  value={String(catalogTotal)}
                />
                <MetricCard
                  icon={Inbox}
                  label="Ultima importacion"
                  value={String(lastImported)}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-border bg-card">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Cuenta Gmail</h2>
                  {status?.connected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Activa
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-zinc-800 text-muted-foreground">
                      Sin conectar
                    </span>
                  )}
                </div>

                {loadingStatus ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
                    <Loader2 className="size-4 animate-spin" />
                    Cargando estado...
                  </div>
                ) : status?.connected ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                      <p className="text-sm font-semibold text-slate-900 text-foreground">
                        {status.googleEmail}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Conectado el {formatDateTime(status.connectedAt)}
                      </p>
                      <p className="mt-3 text-xs leading-5 text-slate-600 text-muted-foreground">
                        Acceso de solo lectura. No enviamos ni modificamos correos.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={disconnectGmail}
                    >
                      <Unplug className="mr-2 size-4" />
                      Desconectar cuenta
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      Autoriza una cuenta Gmail de la organizacion para buscar adjuntos JSON de
                      DTE en el buzon.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="gmail-email">Correo Gmail</Label>
                      <Input
                        id="gmail-email"
                        type="email"
                        inputMode="email"
                        className="h-11"
                        placeholder="usuario@gmail.com"
                        value={gmailEmail}
                        onChange={(event) => setGmailEmail(event.target.value)}
                      />
                    </div>
                    <Button type="button" className="h-11 w-full" onClick={connectGmail}>
                      <Mail className="mr-2 size-4" />
                      Conectar Gmail
                    </Button>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-border bg-card">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarRange className="size-4 text-primary text-primary" />
                  <h2 className="text-lg font-bold">Sincronizacion</h2>
                </div>

                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="date-from">Correos desde</Label>
                    <Input
                      id="date-from"
                      type="date"
                      className="h-11"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      disabled={!status?.connected || syncing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date-to">Correos hasta</Label>
                    <Input
                      id="date-to"
                      type="date"
                      className="h-11"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      disabled={!status?.connected || syncing}
                    />
                  </div>
                </div>

                <p className="mt-4 text-xs leading-5 text-slate-500 text-muted-foreground">
                  {SYNC_CATALOG_HELP} Se buscan adjuntos JSON en correos del rango. Solo se importan
                  DTE 01, 03, 05, 06, 11 y 14. Otros tipos quedan como{' '}
                  <span className="font-medium">{STATUS_LABELS.skipped_unsupported_type}</span>.
                </p>

                <Button
                  type="button"
                  className="mt-4 h-11 w-full"
                  onClick={runSync}
                  disabled={!status?.connected || syncing}
                >
                  {syncing ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 size-4" />
                      Buscar e importar
                    </>
                  )}
                </Button>

                {job ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 border-border bg-card/40">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <SyncStat label="Encontrados" value={job.found_count} />
                      <SyncStat label="Importados" value={job.imported_count} accent />
                      <SyncStat label="Omitidos" value={job.skipped_count} />
                      <SyncStat label="Errores" value={job.error_count} />
                    </div>
                    <Progress value={progressValue} className="h-2" />
                    <p className="text-xs text-slate-500 text-muted-foreground">
                      Rango {job.date_from} — {job.date_to} · estado {job.status}
                    </p>
                  </div>
                ) : null}
              </section>
            </div>

            <section className="rounded-2xl border border-border bg-card shadow-sm">
              {!status?.connected ? (
                <div className="flex min-h-[28rem] flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/15 bg-primary/15 text-primary">
                    <Inbox className="size-8" />
                  </div>
                  <h2 className="text-xl font-bold">Conecta Gmail para comenzar</h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                    Una vez autorizada la cuenta, aqui veras el catalogo de DTE importados,
                    podras filtrarlos y verificarlos en Hacienda.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 md:flex-row md:items-center md:justify-between border-border">
                    <div>
                      <h2 className="text-xl font-bold">Catalogo de DTE importados</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {catalogTotal} documento(s) disponibles
                        {job ? ` · ultimo sync ${job.date_from} — ${job.date_to}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={loadingCatalog}
                        onClick={() => void loadCatalog()}
                      >
                        {loadingCatalog ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 size-4" />
                        )}
                        Actualizar
                      </Button>
                      <Button
                        type="button"
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
                  </div>

                  <div className="space-y-5 p-5">
                    <GmailDocumentFilters
                      filters={catalogFilters}
                      onChange={(patch) => setCatalogFilters((prev) => ({ ...prev, ...patch }))}
                      disabled={loadingCatalog}
                      mailboxOptions={mailboxOptions}
                    />
                    <EmailDocumentResultsTabs
                      catalog={catalog}
                      catalogTotal={catalogTotal}
                      loadingCatalog={loadingCatalog}
                      page={page}
                      pageSize={pageSize}
                      totalPages={totalPages}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      onToggleAll={toggleAll}
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                      showMailboxColumn={showMailboxColumn}
                      onViewLinks={(doc) => void viewLinks(doc)}
                      onViewJson={(doc) => void viewJson(doc)}
                      verifyResults={verifyResults}
                      verifyDownloadHref={verifyDownloadHref}
                      verifyFilename={verifyFilename}
                      verifyLoading={verifyLoading}
                      linkedPreview={linkedPreview}
                      onCloseLinkedPreview={() => setLinkedPreview(null)}
                      loadingLinks={loadingLinks}
                      onViewLinksFromPreview={(rel) => void viewLinks(rel)}
                    />
                  </div>
                </>
              )}
            </section>
          </section>
        </div>
      </main>
    </PlanGate>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 border-border bg-card/50">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p
        className={`text-2xl font-extrabold tracking-tight ${
          accent ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SyncStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 border-border bg-card">
      <p className="text-xs text-slate-500 text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold ${
          accent ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
