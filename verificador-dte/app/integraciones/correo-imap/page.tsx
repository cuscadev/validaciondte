'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  CheckCircle2,
  FileStack,
  Inbox,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Unplug,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import GmailDocumentFilters, {
  type GmailCatalogFilters,
} from '@/components/gmail/GmailDocumentFilters';
import GmailDocumentTable, { STATUS_LABELS } from '@/components/gmail/GmailDocumentTable';
import GmailJsonVerifyPanel from '@/components/gmail/GmailJsonVerifyPanel';
import PlanGate from '@/components/PlanGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { auth } from '@/lib/firebase';
import type { GmailJsonVerifyResult } from '@/lib/gmail/json-verify-result';
import type { GmailDocumentRow } from '@/lib/gmail/types';
import { IMAP_PROVIDER_PRESETS, getImapPreset } from '@/lib/imap/presets';

type ImapStatus = {
  connected: boolean;
  email: string | null;
  host: string | null;
  port: number | null;
  provider: string | null;
  authType: 'password' | 'oauth' | null;
  connectedAt: string | null;
  consentAcceptedAt: string | null;
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
  params.set('source', 'imap');
  params.set('limit', '100');
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.tipoDte) params.set('tipoDte', filters.tipoDte);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  return params.toString();
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
  const defaults = useMemo(() => defaultDateRange(), []);
  const [status, setStatus] = useState<ImapStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [provider, setProvider] = useState('gmail');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('993');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [connecting, setConnecting] = useState(false);

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
  const [verifyFilename, setVerifyFilename] = useState('verificacion_imap_json.xlsx');

  const preset = useMemo(() => getImapPreset(provider), [provider]);
  const isCustom = provider === 'custom';
  const isOAuthProvider = preset?.authMethod === 'oauth';

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await authFetch('/api/integrations/imap/status');
      const json = (await res.json()) as ImapStatus & { error?: string };
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
      toast.success('Cuenta de correo conectada correctamente.');
      window.history.replaceState({}, '', '/integraciones/correo-imap');
    }
    const err = params.get('error');
    if (err) {
      toast.error(decodeURIComponent(err));
      window.history.replaceState({}, '', '/integraciones/correo-imap');
    }
  }, [loadStatus]);

  useEffect(() => {
    if (!status?.connected) return;
    const timer = window.setTimeout(() => {
      void loadCatalog();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [status?.connected, catalogFilters, loadCatalog]);

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
      await loadStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setConnecting(false);
    }
  };

  const disconnectImap = async () => {
    try {
      const res = await authFetch('/api/integrations/imap/status', {
        method: 'DELETE',
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudo desconectar.');
      toast.success('Cuenta desconectada. La clave de aplicacion fue eliminada.');
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
        const res = await authFetch('/api/integrations/imap/sync', {
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
      const rawRes = await authFetch(json.jsonUrl);
      if (!rawRes.ok) throw new Error('No se pudo abrir el JSON.');
      const blobUrl = URL.createObjectURL(await rawRes.blob());
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
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
        setVerifyFilename(exportJson.filename || 'verificacion_imap_json.xlsx');
        if (exportJson.downloadUrl) {
          setVerifyDownloadHref(exportJson.downloadUrl);
        } else if (exportJson.excelBase64) {
          setVerifyDownloadHref(
            `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${exportJson.excelBase64}`
          );
        }
      }

      toast.success(
        `Verificacion JSON completada: ${json.resultados.length} resultado(s) desde el correo.`
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

  const lastImported = status?.lastSync?.importedCount ?? job?.imported_count ?? 0;

  return (
    <PlanGate routeKey="integraciones-imap">
      <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-black dark:text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6 dark:border-white/10 dark:bg-zinc-950">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-yellow-300">
                  <Mail className="size-4" />
                  Integracion IMAP
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                  Importar DTE desde cualquier correo
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base dark:text-zinc-300">
                  Conecta tu buzon por IMAP con una clave de aplicacion (Gmail, Outlook, Zoho o
                  correo corporativo), importa los adjuntos JSON de DTE y verificalos en Hacienda.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
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

          <section className="grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Cuenta de correo</h2>
                  {status?.connected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Activa
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
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
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {status.email}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
                        {status.host}:{status.port} · conectado el{' '}
                        {formatDateTime(status.connectedAt)}
                      </p>
                      <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-zinc-400">
                        Acceso de solo lectura por IMAP. La clave de aplicacion se guarda cifrada
                        y nunca se muestra. Consentimiento aceptado el{' '}
                        {formatDateTime(status.consentAcceptedAt)}.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={disconnectImap}
                    >
                      <Unplug className="mr-2 size-4" />
                      Desconectar cuenta
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
                      Ingresa el correo de la organizacion y su clave de aplicacion para buscar
                      adjuntos JSON de DTE en el buzon.
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="imap-provider">Proveedor</Label>
                      <select
                        id="imap-provider"
                        className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                        value={provider}
                        onChange={(event) => setProvider(event.target.value)}
                      >
                        {IMAP_PROVIDER_PRESETS.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {isCustom ? (
                      <div className="grid grid-cols-[1fr_6rem] gap-2">
                        <div className="space-y-2">
                          <Label htmlFor="imap-host">Servidor IMAP</Label>
                          <Input
                            id="imap-host"
                            className="h-11"
                            placeholder="imap.miempresa.com"
                            value={host}
                            onChange={(event) => setHost(event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="imap-port">Puerto</Label>
                          <Input
                            id="imap-port"
                            className="h-11"
                            inputMode="numeric"
                            value={port}
                            onChange={(event) => setPort(event.target.value)}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-zinc-900 dark:text-zinc-300">
                        Servidor: <span className="font-mono">{preset?.host}</span> · puerto{' '}
                        <span className="font-mono">{preset?.port}</span> (TLS)
                      </p>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="imap-email">
                        Correo{isOAuthProvider ? ' (opcional, para validar la cuenta)' : ''}
                      </Label>
                      <Input
                        id="imap-email"
                        type="email"
                        inputMode="email"
                        className="h-11"
                        placeholder="usuario@miempresa.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </div>

                    {isOAuthProvider ? (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                        <KeyRound className="mr-1 inline size-3" />
                        {preset?.appPasswordHint}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="imap-password">Clave de aplicacion</Label>
                        <Input
                          id="imap-password"
                          type="password"
                          autoComplete="off"
                          className="h-11"
                          placeholder="xxxx xxxx xxxx xxxx"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                        />
                        {preset?.appPasswordHint ? (
                          <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                            <KeyRound className="mr-1 inline size-3" />
                            {preset.appPasswordHint}{' '}
                            {preset.appPasswordHelpUrl ? (
                              <a
                                href={preset.appPasswordHelpUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-amber-600 underline dark:text-yellow-300"
                              >
                                Como generarla
                              </a>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                    )}

                    <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 shrink-0 accent-amber-500"
                        checked={consent}
                        onChange={(event) => setConsent(event.target.checked)}
                      />
                      <span>
                        Autorizo la lectura de este buzon por IMAP con el unico fin de extraer
                        adjuntos JSON de DTE. No se envian ni modifican correos.
                      </span>
                    </label>

                    <Button
                      type="button"
                      className="h-11 w-full"
                      onClick={isOAuthProvider ? connectMicrosoft : connectImap}
                      disabled={connecting}
                    >
                      {connecting ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          {isOAuthProvider ? 'Redirigiendo a Microsoft...' : 'Probando conexion...'}
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 size-4" />
                          {isOAuthProvider ? 'Conectar con Microsoft' : 'Conectar correo'}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarRange className="size-4 text-amber-600 dark:text-yellow-300" />
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

                <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                  Se buscan adjuntos JSON (incluso dentro de ZIP) en correos del rango. Solo se
                  importan DTE 01, 03, 05, 06, 11 y 14. Otros tipos quedan como{' '}
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
                  <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-zinc-900/40">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <SyncStat label="Encontrados" value={job.found_count} />
                      <SyncStat label="Importados" value={job.imported_count} accent />
                      <SyncStat label="Omitidos" value={job.skipped_count} />
                      <SyncStat label="Errores" value={job.error_count} />
                    </div>
                    <Progress value={progressValue} className="h-2" />
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Rango {job.date_from} — {job.date_to} · estado {job.status}
                    </p>
                  </div>
                ) : null}
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
              {!status?.connected ? (
                <div className="flex min-h-[28rem] flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-yellow-300">
                    <Inbox className="size-8" />
                  </div>
                  <h2 className="text-xl font-bold">Conecta tu correo para comenzar</h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-600 dark:text-zinc-300">
                    Una vez conectada la cuenta por IMAP, aqui veras el catalogo de DTE
                    importados, podras filtrarlos y verificarlos en Hacienda.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 md:flex-row md:items-center md:justify-between dark:border-white/10">
                    <div>
                      <h2 className="text-xl font-bold">Catalogo de DTE importados</h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
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
                    />

                    {loadingCatalog && !catalog.length ? (
                      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
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
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center dark:border-white/10 dark:bg-zinc-900/30">
                        <FileStack className="mx-auto mb-3 size-8 text-slate-400" />
                        <p className="font-medium text-slate-900 dark:text-white">
                          Sin documentos importados
                        </p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
                          Ejecuta una sincronizacion o amplia el rango de fechas del buzon.
                        </p>
                      </div>
                    )}

                    <GmailJsonVerifyPanel
                      results={verifyResults}
                      downloadHref={verifyDownloadHref}
                      filename={verifyFilename}
                      loading={verifyLoading}
                    />

                    {linkedPreview ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-zinc-900/40">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">Documentos relacionados</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400">
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
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-zinc-950"
                              >
                                <div>
                                  <span className="font-medium">
                                    {rel.tipo_dte_label || rel.tipo_dte}
                                  </span>
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
                                  onClick={() => void viewLinks(rel)}
                                >
                                  Ver enlaces
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-zinc-300">
                            Sin documentos vinculados.
                          </p>
                        )}
                      </div>
                    ) : null}
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
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-zinc-900/50">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p
        className={`text-2xl font-extrabold tracking-tight ${
          accent ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'
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
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-950">
      <p className="text-xs text-slate-500 dark:text-zinc-400">{label}</p>
      <p
        className={`text-lg font-bold ${
          accent ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
