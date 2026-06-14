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
  Plug,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { toast } from 'sonner';

import GmailDocumentFilters from '@/components/gmail/GmailDocumentFilters';
import EmailDocumentResultsTabs from '@/components/gmail/EmailDocumentResultsTabs';
import { STATUS_LABELS } from '@/components/gmail/GmailDocumentTable';
import ImapConnectionModal from '@/components/imap/ImapConnectionModal';
import PlanGate from '@/components/PlanGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useEmailDocumentCatalog, authFetch } from '@/lib/email-import/use-email-document-catalog';
import {
  emailDocumentCatalogKeys,
  imapIntegrationKeys,
} from '@/lib/email-import/query-keys';
import { useImapIntegrationStatus } from '@/lib/email-import/use-imap-integration-status';
import { notifySyncCompleted, SYNC_CATALOG_HELP } from '@/lib/email-import/sync-plan-messages';
import type { SyncPlanResult } from '@/lib/email-import/sync-plan';
import { invalidateGetQueries } from '@/lib/tanstack-query';
import { getImapPreset } from '@/lib/imap/presets';

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

export default function CorreoImapIntegracionPage() {
  const queryClient = useQueryClient();
  const defaults = useMemo(() => defaultDateRange(), []);
  const statusQuery = useImapIntegrationStatus();
  const status = statusQuery.data ?? null;
  const loadingStatus = statusQuery.isLoading;

  const [provider, setProvider] = useState('gmail');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('993');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [syncing, setSyncing] = useState(false);
  const [job, setJob] = useState<SyncJob | null>(null);

  const catalogState = useEmailDocumentCatalog({
    enabled: Boolean(status?.connected),
    sourceFilter: 'imap',
    connectedEmail: status?.email,
    verifyExportFilename: 'verificacion_imap_json.xlsx',
    verifySuccessLabel: 'Verificacion JSON completada desde IMAP.',
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

  const preset = useMemo(() => getImapPreset(provider), [provider]);
  const isCustom = provider === 'custom';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      toast.success('Cuenta de correo conectada correctamente.');
      void invalidateGetQueries(queryClient, imapIntegrationKeys.all);
      window.history.replaceState({}, '', '/integraciones/correo-imap');
    }
    const err = params.get('error');
    if (err) {
      toast.error(decodeURIComponent(err));
      window.history.replaceState({}, '', '/integraciones/correo-imap');
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
    await invalidateGetQueries(queryClient, imapIntegrationKeys.all);
    await invalidateGetQueries(queryClient, emailDocumentCatalogKeys.all);
  };

  const connectMicrosoft = async () => {
    if (!consent) {
      toast.warning('Debes aceptar el consentimiento de lectura del buzon.');
      return;
    }
    setConnecting(true);
    try {
      const res = await authFetch('/api/integrations/imap/microsoft/connect', {
        method: 'POST',
        body: JSON.stringify({
          returnOrigin: window.location.origin,
          email: email.trim().toLowerCase() || undefined,
        }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error || 'No se pudo iniciar la conexion con Microsoft.');
      }
      window.location.href = json.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
      setConnecting(false);
    }
  };

  const connectImap = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.warning('Ingresa el correo que deseas conectar.');
      return;
    }
    if (!password.trim()) {
      toast.warning('Ingresa la clave de aplicacion.');
      return;
    }
    if (isCustom && !host.trim()) {
      toast.warning('Indica el servidor IMAP de tu proveedor.');
      return;
    }
    if (!consent) {
      toast.warning('Debes aceptar el consentimiento de lectura del buzon.');
      return;
    }

    setConnecting(true);
    try {
      const res = await authFetch('/api/integrations/imap/connect', {
        method: 'POST',
        body: JSON.stringify({
          provider,
          host: isCustom ? host.trim() : preset?.host,
          port: isCustom ? Number(port) || 993 : preset?.port,
          secure: true,
          email: cleanEmail,
          password,
          consent,
        }),
      });
      const json = (await res.json()) as { connected?: boolean; error?: string };
      if (!res.ok || !json.connected) {
        throw new Error(json.error || 'No se pudo conectar la cuenta.');
      }
      toast.success('Cuenta de correo conectada correctamente.');
      setPassword('');
      setConnectionModalOpen(false);
      await refreshIntegration();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setConnecting(false);
    }
  };

  const disconnectImap = async () => {
    setDisconnecting(true);
    try {
      const res = await authFetch('/api/integrations/imap/status', {
        method: 'DELETE',
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudo desconectar.');
      toast.success('Cuenta desconectada. La clave de aplicacion fue eliminada.');
      setJob(null);
      clearCatalog();
      setConnectionModalOpen(false);
      await refreshIntegration();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setDisconnecting(false);
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
        const res = await authFetch('/api/integrations/imap/sync', {
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
    <PlanGate routeKey="integraciones-imap">
      <main className="w-full max-w-full text-foreground">
        <div className="flex w-full flex-col gap-4">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                  <Mail className="size-4" />
                  Integracion IMAP
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                  Importar DTE desde cualquier correo
                </h1>
                <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
                  Conecta tu buzon por IMAP con una clave de aplicacion (Gmail, Outlook, Zoho o
                  correo corporativo), importa los adjuntos JSON de DTE y verificalos en Hacienda.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-auto lg:shrink-0">
                <MetricCard
                  icon={CheckCircle2}
                  label="Estado"
                  value={status?.connected ? 'Conectado' : 'Pendiente'}
                  accent={Boolean(status?.connected)}
                />
                <MetricCard icon={FileStack} label="En catalogo" value={String(catalogTotal)} />
                <MetricCard icon={Inbox} label="Ultima importacion" value={String(lastImported)} />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between md:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                  status?.connected
                    ? 'bg-[color:var(--brand-success)]/15 text-[color:var(--brand-success)]'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {status?.connected ? <CheckCircle2 className="size-5" /> : <Plug className="size-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {loadingStatus
                    ? 'Verificando conexion...'
                    : status?.connected
                      ? status.email
                      : 'Sin cuenta conectada'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {status?.connected
                    ? `${status.host}:${status.port} · conectado ${formatDateTime(status.connectedAt)}`
                    : 'Conecta tu buzon IMAP para importar DTE desde el correo'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {status?.connected ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10"
                    onClick={() => setConnectionModalOpen(true)}
                  >
                    <Settings2 className="mr-2 size-4" />
                    Gestionar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-10 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => setConnectionModalOpen(true)}
                  >
                    <Unplug className="mr-2 size-4" />
                    Desconectar
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-10 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setConnectionModalOpen(true)}
                  disabled={loadingStatus}
                >
                  <Mail className="mr-2 size-4" />
                  Conectar correo
                </Button>
              )}
            </div>
          </section>

          {!status?.connected ? (
            <section className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Inbox className="size-8" />
              </div>
              <h2 className="text-xl font-bold">Conecta tu correo para comenzar</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                Configura IMAP con clave de aplicacion. Luego podras importar por rango de fechas,
                filtrar el catalogo y verificar DTE en Hacienda.
              </p>
              <Button
                type="button"
                className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setConnectionModalOpen(true)}
              >
                <Mail className="mr-2 size-4" />
                Conectar buzon IMAP
              </Button>
            </section>
          ) : (
            <div className="flex flex-col gap-5">
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      <CalendarRange className="size-4" />
                      Importar del buzon
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {SYNC_CATALOG_HELP}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={runSync}
                    disabled={syncing}
                    className="h-11 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="sync-date-from">Correos desde</Label>
                    <Input
                      id="sync-date-from"
                      type="date"
                      className="h-10"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      disabled={syncing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sync-date-to">Correos hasta</Label>
                    <Input
                      id="sync-date-to"
                      type="date"
                      className="h-10"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      disabled={syncing}
                    />
                  </div>
                  {job ? (
                    <>
                      <SyncStat label="Importados" value={job.imported_count} accent />
                      <SyncStat label="Omitidos" value={job.skipped_count} />
                    </>
                  ) : null}
                </div>

                {job ? (
                  <div className="mt-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        Rango {job.date_from} — {job.date_to} · estado {job.status}
                      </span>
                      <span>
                        {job.found_count} encontrados · {job.error_count} errores
                      </span>
                    </div>
                    <Progress value={progressValue} className="h-2" />
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Solo se importan DTE 01, 03, 05, 06, 11 y 14. Otros quedan como{' '}
                    <span className="font-medium">{STATUS_LABELS.skipped_unsupported_type}</span>.
                  </p>
                )}

                <div className="mt-5 border-t border-border pt-5">
                  <GmailDocumentFilters
                    filters={catalogFilters}
                    onChange={(patch) => setCatalogFilters((prev) => ({ ...prev, ...patch }))}
                    disabled={loadingCatalog || syncing}
                    mailboxOptions={mailboxOptions}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex flex-col gap-4 border-b border-border px-5 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Resultados</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {catalogTotal} documento(s) en el catalogo
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
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
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

                <div className="p-5">
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
                    emptyCatalogTitle="Sin documentos importados"
                    emptyCatalogDescription="Elige un rango de fechas arriba y pulsa Buscar e importar."
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
              </section>
            </div>
          )}

          <ImapConnectionModal
            open={connectionModalOpen}
            onClose={() => setConnectionModalOpen(false)}
            status={status}
            loadingStatus={loadingStatus}
            provider={provider}
            onProviderChange={setProvider}
            host={host}
            onHostChange={setHost}
            port={port}
            onPortChange={setPort}
            email={email}
            onEmailChange={setEmail}
            password={password}
            onPasswordChange={setPassword}
            consent={consent}
            onConsentChange={setConsent}
            connecting={connecting}
            onConnectPassword={connectImap}
            onConnectMicrosoft={connectMicrosoft}
            onDisconnect={disconnectImap}
            disconnecting={disconnecting}
            formatDateTime={formatDateTime}
          />
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
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p
        className={`text-2xl font-extrabold tracking-tight ${
          accent ? 'text-[color:var(--brand-success)]' : 'text-foreground'
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
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold ${
          accent ? 'text-[color:var(--brand-success)]' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
