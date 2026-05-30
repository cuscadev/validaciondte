'use client';

import Link from 'next/link';
import { FirebaseError } from 'firebase/app';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, FileCheck2, LockKeyhole, ShieldCheck } from 'lucide-react';

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

import { auth } from '@/lib/firebase';
import { getUser } from '@/lib/firestoreUser';
import { userNeedsOnboardingPath } from '@/lib/onboarding-gate';
import PublicNavbar from '@/components/PublicNavbar';
import { QUERY_CACHE_MS } from '@/components/QueryProvider';

const DASHBOARD_PATH = '/dashboard';
const ONBOARDING_PATH = '/onboarding';

function getLoginErrorDetails(err: unknown) {
	if (err instanceof FirebaseError) {
		return {
			code: err.code,
			message: err.message,
			customData: err.customData,
		};
	}

	if (err instanceof Error) {
		return {
			name: err.name,
			message: err.message,
		};
	}

	return { error: err };
}

function getLoginErrorMessage(err: unknown, fallback: string) {
	if (err instanceof FirebaseError) {
		switch (err.code) {
			case 'auth/invalid-credential':
			case 'auth/user-not-found':
			case 'auth/wrong-password':
				return 'Correo o contrasena incorrectos.';
			case 'auth/invalid-email':
				return 'Ingresa un correo electronico valido.';
			case 'auth/too-many-requests':
				return 'Demasiados intentos fallidos. Intenta nuevamente mas tarde.';
			case 'auth/user-disabled':
				return 'Tu usuario esta bloqueado. Contacta al administrador.';
			case 'auth/network-request-failed':
				return 'No se pudo conectar con Firebase. Revisa tu conexion e intenta de nuevo.';
			case 'permission-denied':
				return 'No tienes permisos para consultar tu perfil. Contacta al administrador.';
			default:
				return fallback;
		}
	}

	return err instanceof Error ? err.message : fallback;
}

async function setSessionCookie(
	user: Awaited<ReturnType<typeof signInWithEmailAndPassword>>['user']
) {
	const token = await user.getIdToken(true);
	document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Strict`;
	sessionStorage.setItem('was-authenticated', 'true');
}

async function recordLoginLog({
	email,
	success,
	reason,
	token,
}: {
	email: string;
	success: boolean;
	reason?: string;
	token?: string;
}) {
	await fetch('/api/login-logs', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify({
			email,
			success,
			reason,
			userAgent: navigator.userAgent,
		}),
	}).catch(() => {});
}

export default function LoginPage() {
	const { t } = useTranslation();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const router = useRouter();
	const queryClient = useQueryClient();

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setLoading(true);

		const normalizedEmail = email.trim().toLowerCase();

		try {
			if (!normalizedEmail || !password) {
				setError('Ingresa tu correo y contrasena.');
				return;
			}

			console.info('[login] Starting Firebase email/password sign-in', {
				email: normalizedEmail,
				authDomain: auth.app.options.authDomain,
				projectId: auth.app.options.projectId,
			});

			const cred = await signInWithEmailAndPassword(
				auth,
				normalizedEmail,
				password
			);

			console.info('[login] Firebase sign-in succeeded', {
				uid: cred.user.uid,
				email: cred.user.email,
				emailVerified: cred.user.emailVerified,
				providerIds: cred.user.providerData.map(
					(provider) => provider.providerId
				),
			});

			const appUser = await queryClient.fetchQuery({
				queryKey: ['users', cred.user.uid],
				queryFn: () => getUser(cred.user.uid),
				staleTime: QUERY_CACHE_MS,
				gcTime: QUERY_CACHE_MS,
			});

			console.info('[login] Firestore profile lookup finished', {
				uid: cred.user.uid,
				profileFound: !!appUser,
				role: appUser?.role,
				totpEnabled: !!appUser?.totpEnabled,
			});

			if (!appUser) {
				await signOut(auth);
				document.cookie = '__session=; path=/; max-age=0; SameSite=Strict';

				throw new Error(
					'No encontramos tu perfil de usuario. Contacta al administrador.'
				);
			}

			if (appUser.disabled) {
				await signOut(auth);
				document.cookie = '__session=; path=/; max-age=0; SameSite=Strict';
				await recordLoginLog({
					email: normalizedEmail,
					success: false,
					reason: 'user_disabled',
				});
				throw new Error('Tu usuario esta bloqueado. Contacta al administrador.');
			}

			if (appUser?.totpEnabled) {
				document.cookie = '__session=; path=/; max-age=0; SameSite=Strict';
				sessionStorage.setItem('totp-uid', cred.user.uid);
				const token = await cred.user.getIdToken();
				await recordLoginLog({
					email: normalizedEmail,
					success: true,
					reason: 'mfa_required',
					token,
				});

				console.info('[login] Redirecting to TOTP verification', {
					uid: cred.user.uid,
				});

				router.replace('/totp-verify');
			} else {
				await setSessionCookie(cred.user);
				const token = await cred.user.getIdToken();
				await recordLoginLog({
					email: normalizedEmail,
					success: true,
					reason: appUser.mustChangePassword ? 'temporary_password' : 'ok',
					token,
				});

				const nextPath = userNeedsOnboardingPath(appUser)
					? ONBOARDING_PATH
					: DASHBOARD_PATH;

				console.info('[login] Redirecting after login', {
					uid: cred.user.uid,
					nextPath,
				});

				router.replace(nextPath);
			}
		} catch (err) {
			console.error('[login] Firebase sign-in failed', {
				email: normalizedEmail,
				...getLoginErrorDetails(err),
			});

			setError(getLoginErrorMessage(err, t('genericError')));
			await recordLoginLog({
				email: normalizedEmail,
				success: false,
				reason: err instanceof FirebaseError ? err.code : err instanceof Error ? err.message : 'unknown',
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-black dark:text-white">
			<div className="fixed left-0 top-0 z-30 w-full">
				<PublicNavbar />
			</div>

			<div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_16%_22%,rgba(234,179,8,0.2),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(59,130,246,0.14),transparent_32%),linear-gradient(135deg,#fff7ed_0%,#f8fafc_50%,#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_16%_22%,rgba(250,204,21,0.2),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(239,68,68,0.18),transparent_32%),linear-gradient(135deg,#030303_0%,#111111_50%,#1c0f0b_100%)]" />

			<div className="absolute inset-0 z-0 opacity-50 [background-image:linear-gradient(rgba(15,23,42,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.07)_1px,transparent_1px)] [background-size:72px_72px] dark:opacity-40 dark:[background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)]" />

			<section className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl items-center px-4 pb-8 pt-24 sm:px-6 sm:pt-28 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,28rem)] lg:gap-16 lg:px-12 xl:gap-24 xl:px-16">
				<div className="hidden w-full max-w-2xl lg:block lg:pl-4 xl:pl-8">
					<p className="mb-5 text-sm font-semibold uppercase tracking-[0.32em] text-amber-500 dark:text-yellow-300">
						ACCESO SEGURO DTE
					</p>

					<h1 className="text-5xl font-extrabold leading-tight text-slate-950 xl:text-[3.4rem] dark:text-white">
						Entra a tu centro de verificación tributaria.
					</h1>

					<p className="mt-6 max-w-xl text-lg leading-7 text-slate-600 dark:text-zinc-300">
						Valida documentos, revisa reportes y administra procesos fiscales
						desde una plataforma protegida para tu equipo.
					</p>

					<div className="mt-10 grid grid-cols-3 gap-4">
						<div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-left shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
							<FileCheck2 className="mb-3 size-6 text-amber-500 dark:text-yellow-300" />
							<p className="text-sm font-semibold">DTE centralizados</p>
						</div>

						<div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-left shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
							<ShieldCheck className="mb-3 size-6 text-amber-500 dark:text-yellow-300" />
							<p className="text-sm font-semibold">MFA disponible</p>
						</div>

						<div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-left shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
							<LockKeyhole className="mb-3 size-6 text-amber-500 dark:text-yellow-300" />
							<p className="text-sm font-semibold">Control de acceso</p>
						</div>
					</div>
				</div>

				<Card className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 text-slate-950 shadow-2xl shadow-black/20 backdrop-blur lg:mx-0 lg:justify-self-center xl:justify-self-start dark:border-white/10 dark:bg-zinc-950/90 dark:text-white dark:shadow-black/40">
					<CardHeader className="space-y-4 p-5 sm:p-6">
						<div className="flex size-12 items-center justify-center rounded-xl bg-yellow-400 text-black shadow-lg shadow-yellow-500/20 sm:size-14">
							<LockKeyhole className="size-6 sm:size-7" />
						</div>

						<div>
							<CardTitle className="text-2xl font-bold text-slate-950 sm:text-3xl dark:text-white">
								{t('loginTitle')}
							</CardTitle>

							<CardDescription className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-300">
								{t('loginDescription')}
							</CardDescription>
						</div>
					</CardHeader>

					<CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
						<form onSubmit={handleLogin} className="space-y-5">
							<div className="space-y-2">
								<Label
									htmlFor="email"
									className="text-slate-700 dark:text-zinc-200"
								>
									{t('email')}
								</Label>

								<Input
									id="email"
									type="email"
									autoComplete="email"
									placeholder={t('emailPlaceholder')}
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="h-12 rounded-xl border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 dark:border-white/10 dark:bg-black/50 dark:text-white dark:placeholder:text-zinc-500"
									required
								/>
							</div>

							<div className="space-y-2">
								<Label
									htmlFor="password"
									className="text-slate-700 dark:text-zinc-200"
								>
									{t('password')}
								</Label>

								<Input
									id="password"
									type={showPassword ? 'text' : 'password'}
									autoComplete="current-password"
									placeholder={t('loginPasswordPlaceholder')}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="h-12 rounded-xl border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 dark:border-white/10 dark:bg-black/50 dark:text-white dark:placeholder:text-zinc-500"
									required
								/>
							</div>

							<label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-zinc-300">
								<input
									type="checkbox"
									checked={showPassword}
									onChange={(e) => setShowPassword(e.target.checked)}
									className="size-4 rounded border-slate-300 accent-yellow-400 dark:border-white/20"
								/>
								Mostrar contrasena
							</label>

							{error && (
								<div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
									{error}
								</div>
							)}

							<Button
								type="submit"
								className="h-12 w-full rounded-xl bg-yellow-400 font-bold text-black transition-all hover:bg-yellow-300"
								disabled={loading}
							>
								{loading ? t('loading') : t('loginButton')}
								{!loading && <ArrowRight className="size-4" />}
							</Button>
						</form>

						<div className="mt-6 text-center text-sm text-slate-500 dark:text-zinc-400">
							<Link
								href="/signup"
								className="font-semibold text-amber-500 transition-colors hover:text-amber-400 dark:text-yellow-300 dark:hover:text-yellow-200"
							>
								{t('noAccount')}
							</Link>

							<div className="mt-3">
								<Link
									href="/reset-password"
									className="font-medium text-slate-600 transition-colors hover:text-slate-950 dark:text-zinc-300 dark:hover:text-white"
								>
									Olvide mi contrasena
								</Link>
							</div>
						</div>
					</CardContent>
				</Card>
			</section>
		</main>
	);
}
