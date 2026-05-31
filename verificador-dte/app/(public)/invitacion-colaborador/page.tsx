'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandLoader } from '@/components/ui/brand-loader';
import { useGetQuery } from '@/lib/tanstack-query';

type InviteInfo = {
  email: string;
  displayName: string;
  orgName: string;
};

function CollaboratorInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const inviteQuery = useGetQuery<InviteInfo>({
    queryKey: ['organization', 'invitation', token],
    path: '/api/organization/invitations/accept',
    params: { token },
    enabled: Boolean(token),
    requireAuth: false,
    oneShot: true,
  });

  const invite = inviteQuery.data ?? null;
  const loading = inviteQuery.isLoading;
  const error =
    inviteQuery.error instanceof Error
      ? inviteQuery.error.message
      : token
        ? ''
        : 'Invitacion invalida';

  async function acceptInvite(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('La contrasena debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Las contrasenas no coinciden');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/organization/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo aceptar la invitacion');
      toast.success('Cuenta creada. Ya puedes iniciar sesion.');
      router.replace('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950 dark:bg-black dark:text-white">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-zinc-950">
        {loading ? (
          <BrandLoader size="lg" label="Cargando invitacion" />
        ) : error ? (
          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-bold">Invitacion no disponible</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button asChild>
              <Link href="/login">Ir al inicio de sesion</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={acceptInvite}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-yellow-400">
                Invitacion
              </p>
              <h1 className="mt-2 text-2xl font-bold">Crear contrasena</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {invite?.displayName}, fuiste invitado a {invite?.orgName}. Usa el correo {invite?.email}.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 6 caracteres"
                autoComplete="new-password"
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contrasena"
                autoComplete="new-password"
                disabled={submitting}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-yellow-400 font-bold text-black hover:bg-yellow-300"
            >
              {submitting ? 'Creando cuenta...' : 'Aceptar invitacion'}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function CollaboratorInvitationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950 dark:bg-black dark:text-white">
          <BrandLoader size="lg" label="Cargando invitacion" />
        </main>
      }
    >
      <CollaboratorInvitationContent />
    </Suspense>
  );
}
