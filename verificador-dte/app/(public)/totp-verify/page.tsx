'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import {
	ArrowRight,
	KeyRound,
	Loader2,
	ShieldCheck,
	ShieldX,
} from 'lucide-react';

import { auth } from '@/lib/firebase';
import { setSessionCookie as writeSessionCookie } from '@/lib/session-cookie';

import PublicNavbar from '@/components/PublicNavbar';

import { Button } from '@/components/ui/button';
import { PUBLIC_AUTH_GRADIENT, PUBLIC_AUTH_GRID } from '@/lib/ui/public-backdrop-classes';

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DASHBOARD_PATH = '/dashboard';

async function applySessionCookie() {
	const user = auth.currentUser;

	if (!user) {
		throw new Error(
			'No hay una sesion activa. Inicia sesion nuevamente.'
		);
	}

	const token = await user.getIdToken(true);

	writeSessionCookie(token);

	sessionStorage.setItem('was-authenticated', 'true');
}

export default function TotpVerifyPage() {
	const [code, setCode] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [uid, setUid] = useState<string | null>(null);

	const router = useRouter();

	useEffect(() => {
		const storedUid = sessionStorage.getItem('totp-uid');

		if (!storedUid) {
			router.push('/login');
			return;
		}

		setUid(storedUid);
	}, [router]);

	const handleVerify = async (event: React.FormEvent) => {
		event.preventDefault();

		if (!uid) return;

		setError('');
		setLoading(true);

		try {
			const res = await fetch('/api/totp/validate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					uid,
					code,
				}),
			});

			const data = (await res.json()) as {
				valid?: boolean;
				error?: string;
			};

			if (!res.ok || !data.valid) {
				setError(
					data.error || 'Codigo incorrecto. Intentalo de nuevo.'
				);

				setCode('');
				return;
			}

			await applySessionCookie();

			sessionStorage.removeItem('totp-uid');

			router.replace(DASHBOARD_PATH);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Error al verificar el codigo. Intentalo de nuevo.'
			);
		} finally {
			setLoading(false);
		}
	};

	const handleCancel = async () => {
		await signOut(auth);

		sessionStorage.removeItem('totp-uid');

		router.push('/login');
	};

	return (
		<main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
			<div className="fixed left-0 top-0 z-30 w-full">
				<PublicNavbar />
			</div>

			<div className={`absolute inset-0 z-0 ${PUBLIC_AUTH_GRADIENT}`} />

			<div className={`absolute inset-0 z-0 ${PUBLIC_AUTH_GRID}`} />

			<section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 pb-8 pt-24 sm:px-6 sm:pt-28 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(24rem,28rem)] lg:items-center lg:gap-16 lg:px-12 xl:gap-24 xl:px-16">
				<div className="hidden w-full max-w-2xl lg:block lg:pl-4 xl:pl-8">
					<p className="mb-5 text-sm font-semibold uppercase tracking-[0.32em] text-primary">
						VERIFICACION SEGURA
					</p>

					<h1 className="text-5xl font-extrabold leading-tight text-foreground xl:text-[3.5rem]">
						Confirma que eres tu antes de entrar.
					</h1>

					<p className="mt-6 max-w-xl text-lg leading-7 text-muted-foreground">
						Ingresa el codigo de tu app autenticadora para proteger tus verificaciones, reportes y procesos DTE.
					</p>

					<div className="mt-10 grid gap-4 sm:grid-cols-2">
						<div className="rounded-xl border border-border bg-card/75 p-5 shadow-sm backdrop-blur">
							<ShieldCheck className="mb-3 size-6 text-primary" />

							<p className="text-sm font-semibold text-foreground">
								Segundo factor activo
							</p>

							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								El acceso continua solo despues de validar tu codigo temporal.
							</p>
						</div>

						<div className="rounded-xl border border-border bg-card/75 p-5 shadow-sm backdrop-blur">
							<KeyRound className="mb-3 size-6 text-primary" />

							<p className="text-sm font-semibold text-foreground">
								Codigo de 6 digitos
							</p>

							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								Usa Google Authenticator, Authy o tu app TOTP preferida.
							</p>
						</div>
					</div>
				</div>

				<Card className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card/90 text-foreground shadow-2xl shadow-black/10 backdrop-blur transition-colors dark:shadow-black/40">
					<CardHeader className="space-y-4 p-5 sm:p-6">
						<div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 sm:size-14">
							<ShieldCheck className="size-6 sm:size-7" />
						</div>

						<div>
							<CardTitle className="text-2xl font-bold text-foreground sm:text-3xl">
								Verificacion en dos pasos
							</CardTitle>

							<CardDescription className="mt-2 text-sm leading-6 text-muted-foreground">
								Ingresa el codigo de tu app de autenticacion.
							</CardDescription>
						</div>
					</CardHeader>

					<CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
						<form
							onSubmit={handleVerify}
							className="space-y-5"
						>
							<div className="space-y-2">
								<Label
									htmlFor="code"
									className="text-muted-foreground"
								>
									Codigo TOTP
								</Label>

								<Input
									id="code"
									type="text"
									inputMode="numeric"
									autoComplete="one-time-code"
									placeholder="123456"
									value={code}
									onChange={(event) =>
										setCode(
											event.target.value.replace(
												/\D/g,
												''
											)
										)
									}
									required
									maxLength={6}
									minLength={6}
									pattern="[0-9]{6}"
									disabled={loading}
									className="h-14 rounded-xl text-center text-2xl font-bold tracking-[0.35em]"
								/>
							</div>

							{error && (
								<div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
									<ShieldX className="mt-0.5 size-4 shrink-0" />

									<span>{error}</span>
								</div>
							)}

							<div className="grid gap-3 sm:grid-cols-[1fr_auto]">
								<Button
									type="submit"
									className="h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90"
									disabled={
										loading || code.length !== 6
									}
								>
									{loading ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<>
											Verificar
											<ArrowRight className="size-4" />
										</>
									)}
								</Button>

								<Button
									type="button"
									variant="outline"
									className="h-12 rounded-xl"
									onClick={handleCancel}
									disabled={loading}
								>
									Cancelar
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</section>
		</main>
	);
}