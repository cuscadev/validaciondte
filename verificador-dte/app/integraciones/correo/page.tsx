'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

import EmailDocumentFilters, {
  type EmailCatalogFilters,
} from '@/components/email/EmailDocumentFilters';
import EmailDocumentTable from '@/components/email/EmailDocumentTable';
import EmailExtractionPanel from '@/components/email/EmailExtractionPanel';
import EmailExtractionTable from '@/components/email/EmailExtractionTable';
import EmailIntegrationSetup, {
  type EmailSetupCheck,
} from '@/components/email/EmailIntegrationSetup';
import EmailJsonVerifyPanel from '@/components/email/EmailJsonVerifyPanel';
import EmailSearchCriteriaPanel from '@/components/email/EmailSearchCriteriaPanel';
import EmailSyncDateField from '@/components/email/EmailSyncDateField';
import EmailWizardProgress, {
  type EmailWizardStepId,
} from '@/components/email/wizard/EmailWizardProgress';
import PlanGate from '@/components/PlanGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { auth } from '@/lib/firebase';
import type { DteJsonResultado } from '@/lib/dte-json-result';
import {
  EMAIL_PROVIDER_PRESETS,
  inferEmailProvider,
  type EmailProvider,
} from '@/lib/email/provider-presets';
import type { EmailDocumentRow, EmailSyncJobResultRow } from '@/lib/supabase-admin';

type EmailConnection = {
  id: string;
  provider: EmailProvider;
  providerLabel: string;
  emailAddress: string;
  authMethod: 'app_password' | 'oauth2';
  connectedAt: string;
  lastSync: {
    id: string;
    status: string;
    dateFrom: string;
    dateTo: string;
    importedCount: number;
    skippedCount: number;
    finishedAt: string | null;
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
  error_message?: string | null;
};

type LinkedPreview = {
  doc: EmailDocumentRow;
  links: Array<{ link_type: string; source_document_id: string; target_document_id: string }>;
  documents: EmailDocumentRow[];
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

function buildCatalogQuery(filters: EmailCatalogFilters, connectionId?: string) {
  const params = new URLSearchParams();
  params.set('importStatus', 'imported');
  params.set('limit', '100');
  if (connectionId) params.set('connectionId', connectionId);
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.tipoDte) params.set('tipoDte', filters.tipoDte);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  return params.toString();
}

function isConsultableSyncResult(result: EmailSyncJobResultRow) {
  return (
    Boolean(result.document_id) &&
    (result.import_status === 'imported' || result.import_status === 'skipped_duplicate')
  );
}

export default function CorreoIntegracionPage() {
  const searchParams = useSearchParams();
  const defaults = useMemo(() => defaultDateRange(), []);
  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connectProvider, setConnectProvider] = useState<EmailProvider>('gmail');
  const [connectEmail, setConnectEmail] = useState('');
  const [connectPassword, setConnectPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const selectedConnection = useMemo(
    () => connections.find((c) => c.id === selectedConnectionId) ?? null,
    [connections, selectedConnectionId]
  );
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [wizardStep, setWizardStep] = useState<EmailWizardStepId>('connect');
  const [syncing, setSyncing] = useState(false);
  const [job, setJob] = useState<SyncJob | null>(null);
  const [extractedResults, setExtractedResults] = useState<EmailSyncJobResultRow[]>([]);
  const [extractionPhase, setExtractionPhase] = useState<'running' | 'completed'>('running');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogFilters, setCatalogFilters] = useState<EmailCatalogFilters>({
    q: '',
    tipoDte: '',
    dateFrom: '',
    dateTo: '',
  });
  const [catalog, setCatalog] = useState<EmailDocumentRow[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [linkedPreview, setLinkedPreview] = useState<LinkedPreview | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResults, setVerifyResults] = useState<DteJsonResultado[]>([]);
  const [setupReady, setSetupReady] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);
  const [setupChecks, setSetupChecks] = useState<EmailSetupCheck[]>([]);
  const [setupOrganizationLinked, setSetupOrganizationLinked] = useState(false);
  const [setupIsSuperadmin, setSetupIsSuperadmin] = useState(false);
  const [setupSupabaseRef, setSetupSupabaseRef] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [suggestedProvider, setSuggestedProvider] = useState<EmailProvider | null>(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const providerInitializedRef = useRef(false);

  const consultableResults = useMemo(
    () => extractedResults.filter(isConsultableSyncResult),
    [extractedResults]
  );

  const consultableDocumentIds = useMemo(
    () => consultableResults.map((r) => r.document_id as string),
    [consultableResults]
  );

  const applyAccountContext = useCallback(
    (email: string | null | undefined, provider: EmailProvider | null | undefined) => {
      const fromApi = email?.trim().toLowerCase() || null;
      const fromAuth = auth.currentUser?.email?.trim().toLowerCase() || null;
      const normalized = fromApi || fromAuth;
      setAccountEmail(normalized);
      if (normalized) setConnectEmail(normalized);
      const resolvedProvider = provider ?? (normalized ? inferEmailProvider(normalized) : null);
      setSuggestedProvider(resolvedProvider);
      if (resolvedProvider) {
        setConnectProvider(resolvedProvider);
        providerInitializedRef.current = true;
      } else if (!providerInitializedRef.current && normalized) {
        setConnectProvider('microsoft');
        providerInitializedRef.current = true;
      }
    },
    []
  );

  const loadSetup = useCallback(async () => {
    setSetupLoading(true);
    try {
      const res = await authFetch('/api/integrations/email/setup');
      const json = (await res.json()) as {
        ready?: boolean;
        organizationLinked?: boolean;
        isSuperadmin?: boolean;
        supabaseProjectRef?: string | null;
        accountEmail?: string | null;
        suggestedProvider?: EmailProvider | null;
        checks?: EmailSetupCheck[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'No se pudo comprobar la configuracion.');
      setSetupReady(Boolean(json.ready));
      setSetupOrganizationLinked(Boolean(json.organizationLinked));
      setSetupIsSuperadmin(Boolean(json.isSuperadmin));
      setSetupSupabaseRef(json.supabaseProjectRef ?? null);
      setSetupChecks(json.checks || []);
      applyAccountContext(json.accountEmail, json.suggestedProvider);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
      setSetupReady(false);
      setSetupChecks([]);
    } finally {
      setSetupLoading(false);
    }
  }, [applyAccountContext]);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await authFetch('/api/integrations/email/status');
      const json = (await res.json()) as {
        connections?: EmailConnection[];
        accountEmail?: string | null;
        suggestedProvider?: EmailProvider | null;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar el estado.');
      applyAccountContext(json.accountEmail, json.suggestedProvider);
      const list = json.connections || [];
      setConnections(list);
      setSelectedConnectionId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id || '';
      });
      if (list.length > 0) {
        setWizardStep((prev) => (prev === 'connect' ? 'search' : prev));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoadingStatus(false);
    }
  }, [applyAccountContext]);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const qs = buildCatalogQuery(catalogFilters, selectedConnectionId || undefined);
      const res = await authFetch(`/api/integrations/email/documents?${qs}`);
      const json = (await res.json()) as {
        documents?: EmailDocumentRow[];
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
  }, [catalogFilters, selectedConnectionId]);

  useEffect(() => {
    void loadSetup();
    void loadStatus();
  }, [loadSetup, loadStatus]);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected === 'microsoft') {
      toast.success('Cuenta Microsoft conectada con OAuth2.');
      void loadStatus();
      window.history.replaceState({}, '', '/integraciones/correo');
    } else if (error) {
      toast.error(decodeURIComponent(error));
      window.history.replaceState({}, '', '/integraciones/correo');
    }
  }, [searchParams, loadStatus]);

  useEffect(() => {
    if (!connections.length || !catalogOpen) return;
    const timer = window.setTimeout(() => {
      void loadCatalog();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [connections.length, catalogOpen, catalogFilters, selectedConnectionId, loadCatalog]);

  const connectMicrosoftOAuth = async () => {
    if (!accountEmail) {
      toast.warning('Tu usuario no tiene correo registrado. Actualiza tu perfil antes de conectar IMAP.');
      return;
    }
    setConnecting(true);
    try {
      const res = await authFetch('/api/integrations/email/microsoft/connect');
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

  const connectAccount = async () => {
    if (!accountEmail) {
      toast.warning('Tu usuario no tiene correo registrado. Actualiza tu perfil antes de conectar IMAP.');
      return;
    }
    if (!connectPassword.trim()) {
      toast.warning('Indica la contraseña de aplicacion de tu correo.');
      return;
    }
    setConnecting(true);
    try {
      const res = await authFetch('/api/integrations/email/connect', {
        method: 'POST',
        body: JSON.stringify({
          provider: connectProvider,
          email: accountEmail,
          appPassword: connectPassword,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudo conectar la cuenta.');
      toast.success('Cuenta de correo conectada.');
      setConnectPassword('');
      setWizardStep('search');
      await loadStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setConnecting(false);
    }
  };

  const disconnectAccount = async (connectionId: string) => {
    try {
      const res = await authFetch(`/api/integrations/email/status/${connectionId}`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudo desconectar.');
      toast.success('Cuenta desconectada.');
      if (selectedConnectionId === connectionId) {
        setJob(null);
        setExtractedResults([]);
        setCatalog([]);
      }
      await loadStatus();
      if (connections.length <= 1) setWizardStep('connect');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  const runSync = async () => {
    if (!selectedConnectionId) {
      toast.warning('Selecciona una cuenta de correo.');
      return;
    }
    if (!dateFrom || !dateTo) {
      toast.warning('Indica fecha desde y hasta.');
      return;
    }
    if (dateFrom > dateTo) {
      toast.warning('La fecha inicial no puede ser mayor que la final.');
      return;
    }

    setSyncing(true);
    setWizardStep('extract');
    setExtractionPhase('running');
    setJob(null);
    setExtractedResults([]);
    setSelectedIds(new Set());
    setVerifyResults([]);

    try {
      const res = await authFetch('/api/integrations/email/sync', {
        method: 'POST',
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          dateFrom,
          dateTo,
        }),
      });
      const json = (await res.json()) as {
        job?: SyncJob;
        results?: EmailSyncJobResultRow[];
        error?: string;
      };
      if (!res.ok || !json.job) {
        throw new Error(json.error || 'Error al iniciar la extraccion.');
      }

      setJob(json.job);
      setExtractedResults(json.results || []);
      setExtractionPhase('completed');
      setWizardStep('confirm');
      toast.success(
        `Extraccion finalizada: ${json.job.imported_count} importados, ${json.job.skipped_count} omitidos.`
      );
      await loadStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
      setWizardStep('search');
    } finally {
      setSyncing(false);
    }
  };

  const verifySelected = async (documentIds?: string[]) => {
    const ids = documentIds ?? Array.from(selectedIds);
    if (!ids.length) {
      toast.warning('Selecciona al menos un documento importado.');
      return;
    }

    setVerifyLoading(true);
    if (!documentIds) {
      setVerifyResults([]);
    }

    try {
      const res = await authFetch('/api/integrations/email/documents/verify-json', {
        method: 'POST',
        body: JSON.stringify({ documentIds: ids }),
      });
      const json = (await res.json()) as {
        resultados?: DteJsonResultado[];
        error?: string;
      };
      if (!res.ok || !json.resultados?.length) {
        throw new Error(json.error || 'No se pudo verificar los JSON seleccionados.');
      }

      setVerifyResults(json.resultados);
      setWizardStep('results');
      toast.success(`Verificacion completada: ${json.resultados.length} resultado(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
      setWizardStep((prev) => (prev === 'results' ? 'confirm' : prev));
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleConfirmConsult = async (wantsConsult: boolean) => {
    if (!wantsConsult) {
      toast.success('Documentos guardados en el catalogo.');
      setWizardStep('search');
      return;
    }
    if (!consultableDocumentIds.length) {
      toast.warning('No hay documentos con JSON disponible para consultar en Hacienda.');
      return;
    }
    setWizardStep('results');
    setVerifyResults([]);
    await verifySelected(consultableDocumentIds);
  };

  const handleChooseDocuments = () => {
    if (!consultableDocumentIds.length) {
      toast.warning('No hay documentos consultables en esta extracción.');
      return;
    }
    setSelectedIds(new Set(consultableDocumentIds));
    setVerifyResults([]);
    setWizardStep('select');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllExtracted = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(consultableDocumentIds));
  };

  const toggleAllCatalog = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(
      new Set(catalog.filter((d) => d.import_status === 'imported').map((d) => d.id))
    );
  };

  const viewJson = async (doc: EmailDocumentRow) => {
    try {
      const res = await authFetch(`/api/integrations/email/documents/${doc.id}`);
      const json = (await res.json()) as {
        document?: EmailDocumentRow;
        jsonUrl?: string | null;
        hasJsonContent?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'No se pudo abrir el JSON.');
      if (json.document?.json_content) {
        const blob = new Blob([json.document.json_content], { type: 'application/json' });
        window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
        return;
      }
      if (json.jsonUrl) {
        window.open(json.jsonUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      toast.warning('Este documento no tiene JSON disponible.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  const viewLinks = async (doc: EmailDocumentRow) => {
    setLoadingLinks(true);
    try {
      const res = await authFetch(`/api/integrations/email/documents/${doc.id}/links`);
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

  const providerHelp = EMAIL_PROVIDER_PRESETS[connectProvider].helpText;

  const connectBlockedReason = useMemo(() => {
    if (setupLoading) return null;
    if (!accountEmail) {
      return 'Tu perfil no tiene correo registrado. Actualiza tu perfil antes de conectar IMAP.';
    }
    if (!setupReady) {
      if (setupIsSuperadmin) {
        const failed = setupChecks.filter((check) => !check.ok);
        if (!failed.length) {
          return 'Completa la configuracion previa de Supabase antes de conectar tu buzon.';
        }
        return `Configuracion pendiente: ${failed
          .slice(0, 3)
          .map((check) => check.detail || check.label)
          .join(' · ')}`;
      }
      return 'La importacion desde correo no esta disponible. Contacte al administrador.';
    }
    return null;
  }, [setupLoading, accountEmail, setupReady, setupChecks, setupIsSuperadmin]);

  const pendingDatabaseSetup = useMemo(
    () =>
      setupIsSuperadmin &&
      setupChecks.some(
        (check) =>
          !check.ok &&
          (check.id.startsWith('table_') || check.id === 'column_json_content')
      ),
    [setupChecks, setupIsSuperadmin]
  );

  const supabaseSqlUrl = setupSupabaseRef
    ? `https://supabase.com/dashboard/project/${setupSupabaseRef}/sql/new`
    : 'https://supabase.com/dashboard';

  const microsoftOAuthConfigured = useMemo(() => {
    const check = setupChecks.find((c) => c.id === 'microsoft_oauth_configured');
    return Boolean(check?.ok);
  }, [setupChecks]);

  const canConnect = Boolean(
    setupReady && accountEmail && !connecting && connectPassword.trim()
  );

  const connectActionHint = useMemo(() => {
    if (setupLoading || connectBlockedReason || canConnect) return null;
    if (!accountEmail) {
      return 'Tu cuenta de acceso no tiene correo registrado. Inicia sesion con el mismo email que tu buzon IMAP o agrega un email en Firebase Authentication para tu usuario.';
    }
    if (!connectPassword.trim()) {
      return `Ingresa la contraseña de aplicacion IMAP de ${accountEmail} para ${EMAIL_PROVIDER_PRESETS[connectProvider].label}.`;
    }
    if (!suggestedProvider) {
      return 'Selecciona tu proveedor de correo (Microsoft 365, Gmail o Yahoo).';
    }
    return null;
  }, [
    setupLoading,
    connectBlockedReason,
    canConnect,
    accountEmail,
    connectPassword,
    connectProvider,
    suggestedProvider,
  ]);

  const canEditConnectForm = Boolean(setupReady && accountEmail && !connecting);

  return (
    <PlanGate routeKey="integraciones-correo">
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Importar DTE desde correo (IMAP)</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Extrae adjuntos JSON desde tu buzón, guarda el contenido en la base de datos y
              consulta en Hacienda con la misma tabla de Consultar JSON.
            </p>
          </div>
          {setupIsSuperadmin ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAdminModalOpen(true)}
            >
              <Settings2 className="mr-2 size-4" />
              Diagnóstico del servidor
            </Button>
          ) : null}
        </div>

        {!setupLoading && !setupReady ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-950">
            La importacion desde correo no esta disponible en este momento. Contacte al
            administrador.
          </div>
        ) : null}

        <Modal
          open={adminModalOpen}
          onClose={() => setAdminModalOpen(false)}
          className="max-h-[85vh] w-full max-w-2xl overflow-y-auto"
        >
          <EmailIntegrationSetup
            variant="plain"
            loading={setupLoading}
            ready={setupReady}
            organizationLinked={setupOrganizationLinked}
            isSuperadmin={setupIsSuperadmin}
            supabaseProjectRef={setupSupabaseRef}
            checks={setupChecks}
            onRefresh={() => void loadSetup()}
          />
        </Modal>

        {connections.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Flujo de extracción</CardTitle>
            </CardHeader>
            <CardContent>
              <EmailWizardProgress activeStep={wizardStep} />
            </CardContent>
          </Card>
        ) : null}

        {(wizardStep === 'connect' || !connections.length) && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="size-4" />
                  Conectar cuenta IMAP
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectBlockedReason ? (
                  <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2">
                    <p className="text-sm text-amber-900">{connectBlockedReason}</p>
                    {pendingDatabaseSetup ? (
                      <a
                        href={supabaseSqlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                      >
                        Abrir SQL Editor en Supabase
                        <ExternalLink className="ml-1 size-3" />
                      </a>
                    ) : null}
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="provider">Proveedor</Label>
                    <select
                      id="provider"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
                      value={connectProvider}
                      onChange={(e) => {
                        providerInitializedRef.current = true;
                        setConnectProvider(e.target.value as EmailProvider);
                      }}
                      disabled={connecting || Boolean(suggestedProvider)}
                    >
                      {Object.values(EMAIL_PROVIDER_PRESETS).map((preset) => (
                        <option key={preset.provider} value={preset.provider}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="connect-email">Correo de tu cuenta (buzon IMAP)</Label>
                    <Input
                      id="connect-email"
                      type="email"
                      readOnly
                      value={connectEmail}
                      disabled={connecting}
                      className="bg-muted/40"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="connect-password">Contraseña de aplicacion IMAP</Label>
                    <Input
                      id="connect-password"
                      type="password"
                      autoComplete="new-password"
                      value={connectPassword}
                      onChange={(e) => setConnectPassword(e.target.value)}
                      disabled={connecting || !canEditConnectForm}
                    />
                    <p className="text-xs text-muted-foreground">
                      {providerHelp} Es la contraseña de aplicacion de{' '}
                      {accountEmail || 'tu correo'}, no la contraseña con la que entras a
                      Verificador DTE.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => void connectAccount()}
                    disabled={!canConnect}
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      'Conectar cuenta'
                    )}
                  </Button>
                  {connectProvider === 'microsoft' && microsoftOAuthConfigured ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void connectMicrosoftOAuth()}
                      disabled={!setupReady || !accountEmail || connecting}
                    >
                      Conectar con OAuth2 (alternativa)
                    </Button>
                  ) : null}
                </div>
                {connectActionHint ? (
                  <p className="text-sm text-muted-foreground">{connectActionHint}</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cuentas conectadas</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingStatus ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Cargando cuentas...
                  </div>
                ) : connections.length ? (
                  <ul className="space-y-2">
                    {connections.map((connection) => (
                      <li
                        key={connection.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{connection.emailAddress}</p>
                          <p className="text-xs text-muted-foreground">
                            {connection.providerLabel} ·{' '}
                            {connection.authMethod === 'oauth2' ? 'OAuth2' : 'IMAP (app password)'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void disconnectAccount(connection.id)}
                        >
                          <Trash2 className="mr-1 size-3" />
                          Desconectar
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aun no hay cuentas conectadas. Agrega una arriba con contraseña de aplicacion.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {connections.length > 0 && wizardStep === 'search' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buscar correos con DTE</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sync-account">Cuenta</Label>
                <select
                  id="sync-account"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={selectedConnectionId}
                  onChange={(e) => setSelectedConnectionId(e.target.value)}
                  disabled={syncing}
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.providerLabel} — {c.emailAddress}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <EmailSyncDateField
                  id="date-from"
                  label="Correo desde"
                  isoValue={dateFrom}
                  onIsoChange={setDateFrom}
                  disabled={syncing}
                />
                <EmailSyncDateField
                  id="date-to"
                  label="Correo hasta"
                  isoValue={dateTo}
                  onIsoChange={setDateTo}
                  disabled={syncing}
                />
              </div>
              <EmailSearchCriteriaPanel
                dateFrom={dateFrom}
                dateTo={dateTo}
                provider={selectedConnection?.provider}
              />
              <Button type="button" onClick={() => void runSync()} disabled={syncing}>
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Extrayendo en servidor…
                  </>
                ) : (
                  'Iniciar extracción'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {(wizardStep === 'extract' || wizardStep === 'confirm') && (
          <EmailExtractionPanel
            job={job}
            results={extractedResults}
            syncing={syncing}
            consulting={verifyLoading}
            consultableCount={consultableDocumentIds.length}
            progressValue={progressValue}
            phase={extractionPhase}
            onConfirmConsult={(wantsConsult) => void handleConfirmConsult(wantsConsult)}
            onChooseDocuments={handleChooseDocuments}
          />
        )}

        {wizardStep === 'select' && (
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Seleccionar documentos a consultar</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {consultableDocumentIds.length} documento(s) consultables en esta extracción
                </p>
              </div>
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
                Consultar seleccionados ({selectedIds.size})
              </Button>
            </CardHeader>
            <CardContent>
              {verifyLoading ? (
                <EmailJsonVerifyPanel results={[]} loading />
              ) : (
                <EmailExtractionTable
                  results={consultableResults}
                  showSelection
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onToggleAll={toggleAllExtracted}
                  emptyMessage="No hay documentos consultables para verificar en Hacienda."
                />
              )}
            </CardContent>
          </Card>
        )}

        {wizardStep === 'results' && (
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Resultados de consulta Hacienda</CardTitle>
              <Button type="button" variant="outline" onClick={() => setWizardStep('search')}>
                Nueva extracción
              </Button>
            </CardHeader>
            <CardContent>
              <EmailJsonVerifyPanel results={verifyResults} loading={verifyLoading} />
            </CardContent>
          </Card>
        )}

        {connections.length > 0 && (
          <Card>
            <CardHeader>
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setCatalogOpen((open) => !open)}
              >
                <div>
                  <CardTitle className="text-base">Catálogo histórico</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Documentos importados anteriormente ({catalogTotal})
                  </p>
                </div>
                {catalogOpen ? (
                  <ChevronUp className="size-5 shrink-0" />
                ) : (
                  <ChevronDown className="size-5 shrink-0" />
                )}
              </button>
            </CardHeader>
            {catalogOpen ? (
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingCatalog}
                    onClick={() => void loadCatalog()}
                  >
                    {loadingCatalog ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Actualizar
                  </Button>
                </div>
                <EmailDocumentFilters
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
                  <EmailDocumentTable
                    documents={catalog}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onToggleAll={toggleAllCatalog}
                    onViewLinks={(doc) => void viewLinks(doc)}
                    onViewJson={(doc) => void viewJson(doc)}
                  />
                ) : (
                  <p className="py-6 text-sm text-muted-foreground">
                    No hay documentos importados.
                  </p>
                )}
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
            ) : null}
          </Card>
        )}
      </main>
    </PlanGate>
  );
}
