'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import PublicNavbar from '@/components/PublicNavbar';
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
import { BrandLoader } from '@/components/ui/brand-loader';
import { PUBLIC_AUTH_GRADIENT, PUBLIC_AUTH_GRID } from '@/lib/ui/public-backdrop-classes';
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
        : 'Enlace invalido. Abre el enlace completo del correo de invitacion.';

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
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="fixed left-0 top-0 z-30 w-full">
        <PublicNavbar />
      </div>

      <div className={`absolute inset-0 z-0 ${PUBLIC_AUTH_GRADIENT}`} />
      <div className={`absolute inset-0 z-0 ${PUBLIC_AUTH_GRID}`} />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 pb-8 pt-24 sm:px-6 sm:pt-28 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)] lg:items-center lg:gap-16 lg:px-12 xl:gap-24 xl:px-16">
        <div className="hidden w-full max-w-2xl lg:block lg:pl-4 xl:pl-8">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.32em] text-primary">
            INVITACION DE EQUIPO
          </p>

          <h1 className="text-5xl font-extrabold leading-tight text-foreground xl:text-[3.5rem]">
            Unete a tu organizacion en Kaiser DTE.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-7 text-muted-foreground">
            Tu administrador te invito al equipo. Crea tu contrasena aqui para activar tu cuenta; no necesitas solicitar acceso ni ingresar codigo de verificacion.
          </p>

          <div className="mt-10 space-y-4">
            <div className="flex gap-4 rounded-xl border border-border bg-card/75 p-5 shadow-sm backdrop-blur">
              <UserPlus className="mt-1 size-6 shrink-0 text-primary" />
              <div>
                <h2 className="font-bold text-foreground">1. Abre el enlace del correo</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Debe llevarte a esta pagina de invitacion, no a solicitud de acceso.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-xl border border-border bg-card/75 p-5 shadow-sm backdrop-blur">
              <ShieldCheck className="mt-1 size-6 shrink-0 text-primary" />
              <div>
                <h2 className="font-bold text-foreground">2. Crea tu contrasena</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Usa el correo indicado en la invitacion y una contrasena segura.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Card className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-card/90 text-foreground shadow-2xl shadow-black/20 backdrop-blur dark:shadow-black/40">
          {loading ? (
            <CardContent className="flex justify-center p-10">
              <BrandLoader size="lg" label="Cargando invitacion" />
            </CardContent>
          ) : error ? (
            <>
              <CardHeader className="space-y-3 p-5 sm:p-6">
                <CardTitle className="text-2xl font-bold">Invitacion no disponible</CardTitle>
                <CardDescription className="text-sm leading-6">{error}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-5 pt-0 sm:p-6 sm:pt-0">
                <p className="text-sm text-muted-foreground">
                  Si el enlace te llevo a solicitud de acceso, pide a tu administrador que reenvie la invitacion desde Usuarios.
                </p>
                <Button asChild className="h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90">
                  <Link href="/login">Ir al inicio de sesion</Link>
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-4 p-5 sm:p-6">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 sm:size-14">
                  <UserPlus className="size-6 sm:size-7" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    {invite?.orgName}
                  </p>
                  <CardTitle className="mt-2 text-2xl font-bold sm:text-3xl">
                    Crear tu contrasena
                  </CardTitle>
                  <CardDescription className="mt-2 text-sm leading-6">
                    Hola {invite?.displayName}, fuiste invitado al equipo. Usa el correo{' '}
                    <span className="font-medium text-foreground">{invite?.email}</span> para iniciar sesion despues.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
                <form className="space-y-4" onSubmit={acceptInvite}>
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
                      className="h-12 rounded-xl"
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
                      className="h-12 rounded-xl"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    {submitting ? 'Creando cuenta...' : 'Aceptar invitacion'}
                    {!submitting && <ArrowRight className="size-4" />}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                  <Link href="/login" className="font-semibold text-primary hover:text-primary/80">
                    Ya tengo cuenta — iniciar sesion
                  </Link>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </section>
    </main>
  );
}

export default function CollaboratorInvitationPage() {
  return (
    <Suspense
      fallback={
        <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
          <BrandLoader size="lg" label="Cargando invitacion" />
        </main>
      }
    >
      <CollaboratorInvitationContent />
    </Suspense>
  );
}
