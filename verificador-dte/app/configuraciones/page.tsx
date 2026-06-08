'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { saveHaciendaBrowserToken } from '@/lib/hacienda-token-storage';

// importa sin '@'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useTranslation } from 'react-i18next';

interface SmtpForm {
  host: string;
  port: string;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
  testEmail: string;
}

interface HaciendaForm {
  nit: string;
  password: string;
  environment: 'test' | 'production';
}

const SMTP_QUERY_KEY = ['admin', 'smtp'] as const;
const HACIENDA_QUERY_KEY = ['hacienda', 'credentials'] as const;

export default function ConfiguracionesPage() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [notif, setNotif] = useState(true);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMessage, setSmtpMessage] = useState('');
  const [smtpError, setSmtpError] = useState('');
  const [haciendaSaving, setHaciendaSaving] = useState(false);
  const [haciendaTesting, setHaciendaTesting] = useState(false);
  const [haciendaMessage, setHaciendaMessage] = useState('');
  const [haciendaError, setHaciendaError] = useState('');
  const [haciendaHasPassword, setHaciendaHasPassword] = useState(false);
  const [haciendaForm, setHaciendaForm] = useState<HaciendaForm>({
    nit: '',
    password: '',
    environment: 'test',
  });
  const [smtpForm, setSmtpForm] = useState<SmtpForm>({
    host: '',
    port: '587',
    secure: false,
    user: '',
    password: '',
    fromEmail: '',
    fromName: 'KayDTe',
    enabled: true,
    testEmail: '',
  });
  const { t } = useTranslation();
  const { appUser } = useAuth();
  const haciendaAccess = usePlanAccess('hacienda-credentials');
  const canShowHaciendaCard = haciendaAccess.isSuperadmin || haciendaAccess.allowed;

  useEffect(() => setMounted(true), []);

  const smtpQuery = useQuery({
    queryKey: SMTP_QUERY_KEY,
    enabled: mounted && appUser?.role === 'superadmin',
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/admin/smtp', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { smtp?: Partial<SmtpForm> | null };
      if (!res.ok) throw new Error('No se pudo cargar SMTP');

      return data.smtp ?? null;
    },
  });

  const haciendaQuery = useQuery({
    queryKey: HACIENDA_QUERY_KEY,
    enabled: mounted && Boolean(appUser) && !haciendaAccess.loading && canShowHaciendaCard,
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/hacienda/credentials', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as {
        nit?: string;
        environment?: 'test' | 'production';
        hasPassword?: boolean;
        lastAuthStatus?: string;
        lastAuthError?: string;
        tokenExpiresAt?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar Hacienda');

      return data;
    },
  });

  useEffect(() => {
    if (!smtpQuery.data) return;

    setSmtpForm((current) => ({
      ...current,
      host: smtpQuery.data?.host ?? '',
      port: String(smtpQuery.data?.port ?? '587'),
      secure: Boolean(smtpQuery.data?.secure),
      user: smtpQuery.data?.user ?? '',
      password: smtpQuery.data?.password ?? '',
      fromEmail: smtpQuery.data?.fromEmail ?? '',
      fromName: smtpQuery.data?.fromName ?? 'KayDTe',
      enabled: smtpQuery.data?.enabled !== false,
    }));
  }, [smtpQuery.data]);

  useEffect(() => {
    if (!haciendaQuery.data) return;

    setHaciendaForm({
      nit: haciendaQuery.data.nit || '',
      password: '',
      environment: haciendaQuery.data.environment === 'production' ? 'production' : 'test',
    });
    setHaciendaHasPassword(Boolean(haciendaQuery.data.hasPassword));
  }, [haciendaQuery.data]);

  const handleSmtpChange = (field: keyof SmtpForm, value: string | boolean) => {
    setSmtpForm((current) => ({ ...current, [field]: value }));
  };

  const handleHaciendaChange = (field: keyof HaciendaForm, value: string) => {
    setHaciendaForm((current) => ({ ...current, [field]: value }));
  };

  const handleSaveHacienda = async (event: React.FormEvent) => {
    event.preventDefault();
    setHaciendaSaving(true);
    setHaciendaError('');
    setHaciendaMessage('');

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/hacienda/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(haciendaForm),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar Hacienda');

      await queryClient.invalidateQueries({ queryKey: HACIENDA_QUERY_KEY });
      setHaciendaMessage('Credenciales de Hacienda guardadas.');
      setHaciendaForm((current) => ({ ...current, password: '' }));
      setHaciendaHasPassword(true);
    } catch (error) {
      setHaciendaError(error instanceof Error ? error.message : 'No se pudo guardar Hacienda');
    } finally {
      setHaciendaSaving(false);
    }
  };

  const handleTestHacienda = async () => {
    setHaciendaTesting(true);
    setHaciendaError('');
    setHaciendaMessage('');

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/hacienda/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          forceRefresh: true,
          environment: haciendaForm.environment,
        }),
      });
      const data = await res.json() as { error?: string; token?: string; fullToken?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudo autenticar con Hacienda');

      saveHaciendaBrowserToken(data.token || data.fullToken || '', haciendaForm.environment);
      await queryClient.invalidateQueries({ queryKey: HACIENDA_QUERY_KEY });
      setHaciendaMessage('Autenticacion con Hacienda correcta. Token guardado en este navegador.');
    } catch (error) {
      setHaciendaError(error instanceof Error ? error.message : 'No se pudo autenticar con Hacienda');
    } finally {
      setHaciendaTesting(false);
    }
  };

  const handleSaveSmtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setSmtpSaving(true);
    setSmtpError('');
    setSmtpMessage('');

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/admin/smtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(smtpForm),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar SMTP');

      await queryClient.invalidateQueries({ queryKey: SMTP_QUERY_KEY });
      setSmtpMessage(smtpForm.testEmail ? 'SMTP guardado y correo de prueba enviado.' : 'SMTP guardado correctamente.');
      setSmtpForm((current) => ({ ...current, testEmail: '', password: current.password || '********' }));
    } catch (error) {
      setSmtpError(error instanceof Error ? error.message : 'No se pudo guardar SMTP');
    } finally {
      setSmtpSaving(false);
    }
  };

  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t('Configuraciones')}</h1>

      {/* Apariencia */}
      <Card>
        <CardHeader>
          <CardTitle>{t('Apariencia')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="tema">{t('Tema oscuro')}</Label>
            <p className="text-xs text-gray-500">
              {t('Cambia entre modo claro y oscuro.')}
            </p>
          </div>
          <Switch
            id="tema"
            checked={isDark}
            onCheckedChange={() => setTheme(isDark ? 'light' : 'dark')}
          />
        </CardContent>
      </Card>

      {/* Notificaciones */}
      <Card>
        <CardHeader>
          <CardTitle>{t('Notificaciones')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="notif">{t('Habilitar notificaciones')}</Label>
            <p className="text-xs text-gray-500">
              {t('Mensajes y alertas del sistema (próximamente).')}
            </p>
          </div>
          <Switch id="notif" checked={notif} onCheckedChange={setNotif} />
        </CardContent>
      </Card>    

      {canShowHaciendaCard && (
      <Card>
        <CardHeader>
          <CardTitle>Ministerio de Hacienda</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveHacienda} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="hacienda-env">Ambiente</Label>
                <select
                  id="hacienda-env"
                  value={haciendaForm.environment}
                  onChange={(e) => handleHaciendaChange('environment', e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="test">Pruebas</option>
                  <option value="production">Produccion</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hacienda-nit">NIT / usuario</Label>
                <Input
                  id="hacienda-nit"
                  value={haciendaForm.nit}
                  onChange={(e) => handleHaciendaChange('nit', e.target.value)}
                  placeholder="0614..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hacienda-password">Contrasena Hacienda</Label>
                <Input
                  id="hacienda-password"
                  type="password"
                  value={haciendaForm.password}
                  onChange={(e) => handleHaciendaChange('password', e.target.value)}
                  placeholder={haciendaHasPassword ? 'Dejar vacio para conservar' : 'Contrasena'}
                  required={!haciendaHasPassword}
                />
              </div>
            </div>

            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              El token de Hacienda se obtiene con <code>/seguridad/auth</code>, se guarda cifrado y se reutiliza hasta su vencimiento para consultar lotes DTE.
            </div>

            {haciendaQuery.data?.lastAuthStatus && (
              <div className="rounded-md bg-slate-50 p-3 text-sm dark:bg-zinc-900">
                Estado ultimo acceso Hacienda: <strong>{haciendaQuery.data.lastAuthStatus}</strong>
                {haciendaQuery.data.tokenExpiresAt ? ` · vence ${new Date(haciendaQuery.data.tokenExpiresAt).toLocaleString('es-SV')}` : ''}
              </div>
            )}

            {haciendaError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{haciendaError}</div>}
            {haciendaMessage && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{haciendaMessage}</div>}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={haciendaSaving}>
                {haciendaSaving ? 'Guardando...' : 'Guardar Hacienda'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestHacienda}
                disabled={haciendaTesting || (!haciendaHasPassword && !haciendaForm.password)}
              >
                {haciendaTesting ? 'Autenticando...' : 'Probar autenticacion'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      {appUser?.role === 'superadmin' && (
        <Card>
          <CardHeader>
            <CardTitle>SMTP global</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSmtp} className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="smtp-enabled">Habilitar envio de correos</Label>
                  <p className="text-xs text-gray-500">Se usara para verificaciones, aprobaciones y restablecimiento.</p>
                </div>
                <Switch
                  id="smtp-enabled"
                  checked={smtpForm.enabled}
                  onCheckedChange={(value) => handleSmtpChange('enabled', value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="smtp-host">Host</Label>
                  <Input id="smtp-host" value={smtpForm.host} onChange={(e) => handleSmtpChange('host', e.target.value)} placeholder="smtp.gmail.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">Puerto</Label>
                  <Input id="smtp-port" type="number" value={smtpForm.port} onChange={(e) => handleSmtpChange('port', e.target.value)} required />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp-user">Usuario SMTP</Label>
                  <Input id="smtp-user" value={smtpForm.user} onChange={(e) => handleSmtpChange('user', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-password">Contrasena SMTP</Label>
                  <Input id="smtp-password" type="password" value={smtpForm.password} onChange={(e) => handleSmtpChange('password', e.target.value)} required />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp-from-email">Correo remitente</Label>
                  <Input id="smtp-from-email" type="email" value={smtpForm.fromEmail} onChange={(e) => handleSmtpChange('fromEmail', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-from-name">Nombre remitente</Label>
                  <Input id="smtp-from-name" value={smtpForm.fromName} onChange={(e) => handleSmtpChange('fromName', e.target.value)} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="smtp-secure">Conexion segura SSL/TLS</Label>
                  <p className="text-xs text-gray-500">Activalo normalmente para puerto 465. Para 587 suele ir apagado.</p>
                </div>
                <Switch
                  id="smtp-secure"
                  checked={smtpForm.secure}
                  onCheckedChange={(value) => handleSmtpChange('secure', value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-test">Correo de prueba opcional</Label>
                <Input id="smtp-test" type="email" value={smtpForm.testEmail} onChange={(e) => handleSmtpChange('testEmail', e.target.value)} placeholder="admin@empresa.com" />
              </div>

              {smtpError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{smtpError}</div>}
              {smtpMessage && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{smtpMessage}</div>}

              <Button type="submit" disabled={smtpSaving}>
                {smtpSaving ? 'Guardando...' : 'Guardar SMTP'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
