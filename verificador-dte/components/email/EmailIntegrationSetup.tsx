'use client';

import { CheckCircle2, Circle, ExternalLink, Loader2, RefreshCw, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export type EmailSetupCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
};

type EmailIntegrationSetupProps = {
  loading: boolean;
  ready: boolean;
  organizationLinked: boolean;
  isSuperadmin: boolean;
  supabaseProjectRef: string | null;
  checks: EmailSetupCheck[];
  onRefresh: () => void;
  variant?: 'card' | 'plain';
};

function CheckRow({ label, ok, detail }: EmailSetupCheck) {
  return (
    <li className="flex gap-3 rounded-lg border border-border/60 px-3 py-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </li>
  );
}

export default function EmailIntegrationSetup({
  loading,
  ready,
  organizationLinked,
  isSuperadmin,
  supabaseProjectRef,
  checks,
  onRefresh,
  variant = 'card',
}: EmailIntegrationSetupProps) {
  const supabaseSqlUrl = supabaseProjectRef
    ? `https://supabase.com/dashboard/project/${supabaseProjectRef}/sql/new`
    : 'https://supabase.com/dashboard';

  const pendingDatabase = checks.some(
    (check) =>
      (check.id.startsWith('table_') || check.id === 'column_json_content') && !check.ok
  );

  const inner = (
    <>
      <div className="flex flex-row flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-base font-semibold">
          <Settings2 className="size-4" />
          Diagnóstico del servidor
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="mr-1 size-3" />
              Verificar de nuevo
            </>
          )}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Comprobaciones de Supabase, tablas IMAP y columna json_content. Solo visible para
        superadmin.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Comprobando configuracion...
        </div>
      ) : (
        <ul className="space-y-2">
          {checks.map((check) => (
            <CheckRow key={check.id} {...check} />
          ))}
        </ul>
      )}

      {!organizationLinked && !loading ? (
        <div className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm">
          El usuario actual no tiene organizacion vinculada.
        </div>
      ) : null}

      {pendingDatabase && !loading ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-background p-4">
          <p className="text-sm font-medium">Migracion en Supabase</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Abre el SQL Editor de tu proyecto Supabase.</li>
            <li>
              Ejecuta{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                supabase/APPLY_EMAIL_IMAP.sql
              </code>{' '}
              y{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                004_email_json_content.sql
              </code>
              .
            </li>
            <li>Pulsa Run y luego &quot;Verificar de nuevo&quot;.</li>
          </ol>
          <Button type="button" size="sm" variant="secondary" asChild>
            <a href={supabaseSqlUrl} target="_blank" rel="noopener noreferrer">
              Abrir SQL Editor en Supabase
              <ExternalLink className="ml-1 size-3" />
            </a>
          </Button>
        </div>
      ) : null}

      {isSuperadmin && !loading ? (
        <p className="text-xs text-muted-foreground">
          Variables de servidor (.env.local en la raiz): Supabase URL, service role key y clave
          de cifrado IMAP.
        </p>
      ) : null}

      {ready && !loading ? (
        <p className="text-sm font-medium text-emerald-700">Configuracion lista para IMAP.</p>
      ) : null}
    </>
  );

  if (variant === 'plain') {
    return <div className="space-y-4">{inner}</div>;
  }

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="space-y-4 pt-6">{inner}</CardContent>
    </Card>
  );
}
