'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  KeyRound,
  Loader2,
  Play,
  Shield,
} from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FlowResponse = {
  success?: boolean;
  id?: string;
  status?: string;
  codigoGeneracion?: string;
  numeroControl?: string;
  selloRecepcion?: string;
  finalPackage?: {
    downloads?: {
      json?: string;
    };
  };
  haciendaResponse?: unknown;
  error?: string;
};

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function firebaseToken() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sesion no autorizada');
  return token;
}

export default function FacturacionPruebaEmisionPage() {
  const { appUser, authChecked } = useAuth();
  const [nit, setNit] = useState('06141812151015');
  const [haciendaPassword, setHaciendaPassword] = useState('');
  const [passwordPri, setPasswordPri] = useState('');
  const [transmitir, setTransmitir] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [haciendaReady, setHaciendaReady] = useState(false);
  const [result, setResult] = useState<FlowResponse | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isSuperadmin = appUser?.role === 'superadmin';
  const canUseFacturacion = isSuperadmin || appUser?.role === 'cliente';
  const normalizedNit = nit.replace(/\D/g, '');

  const canAuthenticate = useMemo(
    () => canUseFacturacion && normalizedNit && haciendaPassword.trim() && !authenticating,
    [authenticating, canUseFacturacion, haciendaPassword, normalizedNit],
  );

  const canSubmit = useMemo(
    () =>
      canUseFacturacion &&
      haciendaReady &&
      normalizedNit &&
      passwordPri.trim() &&
      !loading,
    [canUseFacturacion, haciendaReady, loading, normalizedNit, passwordPri],
  );

  const authenticateHacienda = async () => {
    setAuthenticating(true);
    setError('');
    setNotice('');

    try {
      const token = await firebaseToken();
      const credentials = await fetch('/api/hacienda/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nit: normalizedNit,
          password: haciendaPassword,
          environment: 'test',
        }),
      });
      const credentialsPayload = await credentials.json().catch(() => ({}));
      if (!credentials.ok) {
        throw new Error(credentialsPayload.error || 'No se pudieron guardar credenciales de Hacienda');
      }

      const session = await fetch('/api/hacienda/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          forceRefresh: true,
          environment: 'test',
        }),
      });
      const sessionPayload = await session.json().catch(() => ({}));
      if (!session.ok) {
        throw new Error(sessionPayload.error || 'No se pudo obtener token de Hacienda');
      }

      setHaciendaReady(true);
      setNotice('Token de Hacienda obtenido para ambiente test.');
    } catch (err) {
      setHaciendaReady(false);
      setError(err instanceof Error ? err.message : 'No se pudo autenticar con Hacienda');
    } finally {
      setAuthenticating(false);
    }
  };

  const runFlow = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    setResult(null);

    try {
      const token = await firebaseToken();

      const res = await fetch('/api/facturacion/test-flow/factura', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nit: normalizedNit,
          passwordPri,
          transmitir,
        }),
      });

      const payload = (await res.json()) as FlowResponse;
      if (!res.ok) throw new Error(payload.error || 'No se pudo ejecutar el flujo');
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ejecutar el flujo');
    } finally {
      setLoading(false);
    }
  };

  const downloadJson = async () => {
    if (!result?.finalPackage?.downloads?.json) return;

    try {
      const token = await firebaseToken();
      const res = await fetch(result.finalPackage.downloads.json, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('No se pudo descargar el JSON');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.codigoGeneracion || result.id || 'factura-prueba'}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el JSON');
    }
  };

  if (!authChecked) return null;

  if (!canUseFacturacion) {
    return (
      <main className="min-h-[calc(100vh-5rem)] bg-background text-foreground">
        <Card className="mx-auto max-w-xl border-brand-orange/60 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5 text-primary" />
              Acceso restringido
            </CardTitle>
            <CardDescription>
              Este flujo de facturacion esta disponible para clientes y superadmin.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-background text-foreground">
      <div className="flex w-full max-w-none flex-col gap-4 p-0">
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-primary text-primary">
                Facturacion electronica
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
                Prueba de emision completa
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                Obtiene token de Hacienda, busca el certificado .crt del servidor, firma el DTE y transmite a Hacienda test.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background p-4 text-sm">
              <p className="font-semibold">Coleccion Firebase</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">Supabase (tablas dte_emisiones_*)</p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[30rem_minmax(0,1fr)]">
          <div className="grid gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Paso 1: Hacienda</CardTitle>
                <CardDescription>
                  El NIT sera usado como emisor y usuario de Hacienda para obtener token.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="nit">NIT emisor / usuario Hacienda</Label>
                  <Input
                    id="nit"
                    value={nit}
                    onChange={(event) => {
                      setNit(event.target.value.replace(/\D/g, ''));
                      setHaciendaReady(false);
                    }}
                    placeholder="06141812151015"
                    inputMode="numeric"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="haciendaPassword">Clave de Hacienda</Label>
                  <Input
                    id="haciendaPassword"
                    type="password"
                    value={haciendaPassword}
                    onChange={(event) => {
                      setHaciendaPassword(event.target.value);
                      setHaciendaReady(false);
                    }}
                    placeholder="Clave para auth de Hacienda"
                  />
                </div>

                <Button
                  type="button"
                  onClick={authenticateHacienda}
                  disabled={!canAuthenticate}
                  className="bg-primary font-bold text-black hover:bg-primary/90"
                >
                  {authenticating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Autenticando
                    </>
                  ) : (
                    <>
                      <KeyRound className="size-4" />
                      Obtener token Hacienda
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Paso 2: Firmar y emitir</CardTitle>
                <CardDescription>
                  La clave privada se usa solo para firmar el certificado del servidor.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="passwordPri">Clave privada del certificado</Label>
                  <Input
                    id="passwordPri"
                    type="password"
                    value={passwordPri}
                    onChange={(event) => setPasswordPri(event.target.value)}
                    placeholder="passwordPri"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={transmitir}
                    onChange={(event) => setTransmitir(event.target.checked)}
                    className="size-4 accent-primary"
                  />
                  <span>Transmitir a Hacienda test</span>
                </label>

                <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <StatusLine ready={haciendaReady} label="Token Hacienda" />
                  <StatusLine ready={Boolean(passwordPri.trim())} label="Clave privada capturada" />
                </div>

                <Button
                  onClick={runFlow}
                  disabled={!canSubmit}
                  className="bg-primary font-bold text-black hover:bg-primary/90"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Ejecutando flujo
                    </>
                  ) : (
                    <>
                      <Play className="size-4" />
                      Emitir factura de prueba
                    </>
                  )}
                </Button>

                {notice && (
                  <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                    <span>{notice}</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="min-h-[28rem] border-border bg-card">
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
              <CardDescription>
                Aqui veras el sello de recepcion, respuesta de Hacienda y el ID guardado en Firebase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!result ? (
                <div className="flex min-h-[18rem] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                  Ejecuta el flujo para ver la respuesta.
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <ResultStat label="Estado" value={result.status || 'ok'} />
                    <ResultStat label="Codigo" value={result.codigoGeneracion || '-'} mono />
                    <ResultStat label="Sello" value={result.selloRecepcion || '-'} mono />
                  </div>

                  {result.finalPackage?.downloads?.json && (
                    <Button type="button" variant="outline" className="w-fit" onClick={downloadJson}>
                      <Download className="size-4" />
                      Descargar JSON guardado
                    </Button>
                  )}

                  <pre className="max-h-[34rem] overflow-auto rounded-lg border border-border bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                    {stringify(result)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function StatusLine({ ready, label }: { ready: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className={ready ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}>
        {ready ? 'Listo' : 'Pendiente'}
      </span>
    </div>
  );
}

function ResultStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={`mt-1 break-all text-xs ${mono ? 'font-mono' : 'font-bold'}`}>{value}</p>
    </div>
  );
}
