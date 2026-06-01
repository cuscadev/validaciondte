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
		<main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 transition-colors dark:bg-black dark:text-white">
			<div className="fixed left-0 top-0 z-30 w-full">
				<PublicNavbar />
			</div>

			<div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_18%_22%,rgba(234,179,8,0.20),transparent_30%),radial-gradient(circle_at_84%_20%,rgba(59,130,246,0.14),transparent_34%),linear-gradient(135deg,#fff7ed_0%,#f8fafc_52%,#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_18%_22%,rgba(250,204,21,0.2),transparent_30%),radial-gradient(circle_at_84%_20%,rgba(239,68,68,0.18),transparent_34%),linear-gradient(135deg,#030303_0%,#111111_52%,#1c0f0b_100%)]" />

			<div className="absolute inset-0 z-0 opacity-50 [background-image:linear-gradient(rgba(15,23,42,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.07)_1px,transparent_1px)] [background-size:72px_72px] dark:opacity-40 dark:[background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)]" />

			<section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 pb-8 pt-24 sm:px-6 sm:pt-28 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(24rem,28rem)] lg:items-center lg:gap-16 lg:px-12 xl:gap-24 xl:px-16">
				<div className="hidden w-full max-w-2xl lg:block lg:pl-4 xl:pl-8">
					<p className="mb-5 text-sm font-semibold uppercase tracking-[0.32em] text-amber-500 dark:text-yellow-300">
						VERIFICACION SEGURA
					</p>

					<h1 className="text-5xl font-extrabold leading-tight text-slate-950 xl:text-[3.5rem] dark:text-white">
						Confirma que eres tu antes de entrar.
					</h1>

					<p className="mt-6 max-w-xl text-lg leading-7 text-slate-600 dark:text-zinc-300">
						Ingresa el codigo de tu app autenticadora para proteger tus verificaciones, reportes y procesos DTE.
					</p>

					<div className="mt-10 grid gap-4 sm:grid-cols-2">
						<div className="rounded-xl border border-slate-200 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
							<ShieldCheck className="mb-3 size-6 text-amber-500 dark:text-yellow-300" />

							<p className="text-sm font-semibold text-slate-950 dark:text-white">
								Segundo factor activo
							</p>

							<p className="mt-1 text-xs leading-5 text-slate-600 dark:text-zinc-400">
								El acceso continua solo despues de validar tu codigo temporal.
							</p>
						</div>

						<div className="rounded-xl border border-slate-200 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
							<KeyRound className="mb-3 size-6 text-amber-500 dark:text-yellow-300" />

							<p className="text-sm font-semibold text-slate-950 dark:text-white">
								Codigo de 6 digitos
							</p>

							<p className="mt-1 text-xs leading-5 text-slate-600 dark:text-zinc-400">
								Usa Google Authenticator, Authy o tu app TOTP preferida.
							</p>
						</div>
					</div>
				</div>

				<Card className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 text-slate-950 shadow-2xl shadow-black/10 backdrop-blur transition-colors dark:border-white/10 dark:bg-zinc-950/90 dark:text-white dark:shadow-black/40">
					<CardHeader className="space-y-4 p-5 sm:p-6">
						<div className="flex size-12 items-center justify-center rounded-xl bg-yellow-400 text-black shadow-lg shadow-yellow-500/20 sm:size-14">
							<ShieldCheck className="size-6 sm:size-7" />
						</div>

						<div>
							<CardTitle className="text-2xl font-bold text-slate-950 sm:text-3xl dark:text-white">
								Verificacion en dos pasos
							</CardTitle>

							<CardDescription className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-300">
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
									className="text-slate-700 dark:text-zinc-200"
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
									className="h-14 rounded-xl border-slate-200 bg-white text-center text-2xl font-bold tracking-[0.35em] text-slate-950 placeholder:text-slate-400 dark:border-white/10 dark:bg-black/50 dark:text-white dark:placeholder:text-zinc-600"
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
									className="h-12 w-full rounded-xl bg-yellow-400 font-bold text-black hover:bg-yellow-300"
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
									className="h-12 rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white"
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