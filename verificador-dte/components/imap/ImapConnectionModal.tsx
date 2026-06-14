'use client';

import {
  KeyRound,
  Loader2,
  Mail,
  Settings2,
  Unplug,
} from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IMAP_PROVIDER_PRESETS, getImapPreset } from '@/lib/imap/presets';

export type ImapConnectionStatus = {
  connected: boolean;
  email: string | null;
  host: string | null;
  port: number | null;
  connectedAt: string | null;
  consentAcceptedAt: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  status: ImapConnectionStatus | null;
  loadingStatus: boolean;
  provider: string;
  onProviderChange: (value: string) => void;
  host: string;
  onHostChange: (value: string) => void;
  port: string;
  onPortChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  connecting: boolean;
  onConnectPassword: () => void;
  onConnectMicrosoft: () => void;
  onDisconnect: () => void;
  disconnecting?: boolean;
  formatDateTime: (value: string | null | undefined) => string;
};

export default function ImapConnectionModal({
  open,
  onClose,
  status,
  loadingStatus,
  provider,
  onProviderChange,
  host,
  onHostChange,
  port,
  onPortChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  consent,
  onConsentChange,
  connecting,
  onConnectPassword,
  onConnectMicrosoft,
  onDisconnect,
  disconnecting = false,
  formatDateTime,
}: Props) {
  const preset = getImapPreset(provider);
  const isCustom = provider === 'custom';
  const isOAuthProvider = preset?.authMethod === 'oauth';
  const connected = Boolean(status?.connected);

  return (
    <Modal
      open={open}
      onClose={onClose}
      disableClose={connecting || disconnecting}
      className="max-h-[90vh] w-full max-w-lg overflow-y-auto"
    >
      <div className="pr-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            {connected ? <Settings2 className="size-5" /> : <Mail className="size-5" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {connected ? 'Cuenta conectada' : 'Conectar buzon IMAP'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {connected
                ? 'Solo lectura. La clave se guarda cifrada y no se muestra de nuevo.'
                : 'Usa una clave de aplicacion. No se envian ni modifican correos.'}
            </p>
          </div>
        </div>

        {loadingStatus ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Cargando estado...
          </div>
        ) : connected && status ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <p className="font-semibold text-slate-900 dark:text-white">{status.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {status.host}:{status.port} · conectado el {formatDateTime(status.connectedAt)}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                Consentimiento aceptado el {formatDateTime(status.consentAcceptedAt)}
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={disconnecting}>
                Cerrar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={onDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Unplug className="mr-2 size-4" />
                )}
                Desconectar cuenta
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-imap-provider">Proveedor</Label>
              <select
                id="modal-imap-provider"
                className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30 dark:text-white dark:[color-scheme:dark] [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-zinc-900 dark:[&>option]:text-white"
                value={provider}
                onChange={(event) => onProviderChange(event.target.value)}
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
                  <Label htmlFor="modal-imap-host">Servidor IMAP</Label>
                  <Input
                    id="modal-imap-host"
                    className="h-11"
                    placeholder="imap.miempresa.com"
                    value={host}
                    onChange={(event) => onHostChange(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modal-imap-port">Puerto</Label>
                  <Input
                    id="modal-imap-port"
                    className="h-11"
                    inputMode="numeric"
                    value={port}
                    onChange={(event) => onPortChange(event.target.value)}
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
              <Label htmlFor="modal-imap-email">
                Correo{isOAuthProvider ? ' (opcional)' : ''}
              </Label>
              <Input
                id="modal-imap-email"
                type="email"
                inputMode="email"
                className="h-11"
                placeholder="usuario@miempresa.com"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
              />
            </div>

            {isOAuthProvider ? (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs leading-5 text-primary">
                <KeyRound className="mr-1 inline size-3" />
                {preset?.appPasswordHint}
              </p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="modal-imap-password">Clave de aplicacion</Label>
                <Input
                  id="modal-imap-password"
                  type="password"
                  autoComplete="off"
                  className="h-11"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
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
                        className="font-medium text-primary underline"
                      >
                        Como generarla
                      </a>
                    ) : null}
                  </p>
                ) : null}
              </div>
            )}

            <label className="flex items-start gap-2 rounded-lg border border-border bg-muted px-3 py-3 text-xs leading-5 text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={consent}
                onChange={(event) => onConsentChange(event.target.checked)}
              />
              <span>
                Autorizo la lectura de este buzon por IMAP con el unico fin de extraer adjuntos
                JSON de DTE.
              </span>
            </label>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={connecting}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={isOAuthProvider ? onConnectMicrosoft : onConnectPassword}
                disabled={connecting}
              >
                {connecting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {isOAuthProvider ? 'Redirigiendo...' : 'Probando conexion...'}
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 size-4" />
                    {isOAuthProvider ? 'Conectar con Microsoft' : 'Conectar correo'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
