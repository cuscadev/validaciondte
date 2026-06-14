'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound, MailCheck } from 'lucide-react';
import PublicNavbar from '@/components/PublicNavbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PUBLIC_AUTH_GRADIENT, PUBLIC_AUTH_GRID } from '@/lib/ui/public-backdrop-classes';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el codigo.');
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el codigo.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudo verificar el codigo.');
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar el codigo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div className="fixed left-0 top-0 z-30 w-full">
        <PublicNavbar />
      </div>
      <div className={`absolute inset-0 z-0 ${PUBLIC_AUTH_GRADIENT}`} />
      <div className={`absolute inset-0 z-0 ${PUBLIC_AUTH_GRID}`} />
      <Card className="relative z-10 mt-16 w-full max-w-md border-border bg-card/90 text-foreground shadow-2xl shadow-black/10 backdrop-blur">
        <CardHeader>
          <div className="flex size-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
            {step === 'done' ? <MailCheck className="size-6" /> : <KeyRound className="size-6" />}
          </div>
          <CardTitle>Restablecer clave</CardTitle>
          <CardDescription className="text-muted-foreground">
            {step === 'email' && 'Te enviaremos un codigo de 6 digitos al correo.'}
            {step === 'code' && 'Ingresa el codigo recibido para enviarte una contrasena temporal.'}
            {step === 'done' && 'Te enviamos una contrasena temporal. Al iniciar sesion deberas cambiarla.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' && (
            <form onSubmit={requestCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electronico</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">{error}</div>}
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar codigo'}
              </Button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={verifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Codigo de 6 digitos</Label>
                <Input id="code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
              </div>
              {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">{error}</div>}
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading || code.length !== 6}>
                {loading ? 'Verificando...' : 'Verificar y enviar clave temporal'}
              </Button>
            </form>
          )}

          {step === 'done' && (
            <Button asChild className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/login">Ir al login</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
