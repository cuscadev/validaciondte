'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
	ArrowRight,
	ClipboardCheck,
	FileText,
	ShieldCheck,
	UserPlus,
} from 'lucide-react';

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

import { toast, Toaster } from 'sonner';

const PLAN_LABELS: Record<string, string> = {
	free: 'Free',
	premium: 'Premium',
	pro: 'Pro',
};

function formatPhone(value: string) {
	const digits = value.replace(/\D/g, '').slice(0, 8);

	if (digits.length <= 4) {
		return digits;
	}

	return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export default function RegisterPage() {
	const { t } = useTranslation();
	const initializedPlanMessage = useRef(false);

	const [nombre, setNombre] = useState('');
	const [email, setEmail] = useState('');
	const [telefono, setTelefono] = useState('');
	const [mensaje, setMensaje] = useState('');
	const [verificationCode, setVerificationCode] = useState('');
	const [requestId, setRequestId] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [awaitingCode, setAwaitingCode] = useState(false);

	useEffect(() => {
		if (initializedPlanMessage.current) return;
		initializedPlanMessage.current = true;

		const params = new URLSearchParams(window.location.search);
		const planId = params.get('plan')?.trim().toLowerCase();
		if (!planId) return;

		const planLabel = PLAN_LABELS[planId] ?? planId;
		setMensaje((current) =>
			current.trim()
				? current
				: `Estoy interesado en el plan ${planLabel}. Me gustaria recibir informacion para activar el acceso.`
		);
	}, []);

	const requestAccessCode = async () => {
		setError('');
		setSuccess(false);
		setLoading(true);

		try {
			const res = await fetch('/api/access-requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nombre,
					email,
					telefono: formatPhone(telefono),
					mensaje,
				}),
			});

			const data = (await res.json()) as {
				requestId?: string;
				error?: string;
			};

			if (!res.ok || !data.requestId) {
				throw new Error(data.error || 'Error');
			}

			setRequestId(data.requestId);
			setAwaitingCode(true);

			toast.success('Te enviamos un codigo de 6 digitos al correo.');
		} catch (err) {
			const msg =
				err instanceof Error
					? err.message
					: t('register.genericError');

			setError(msg);
			toast.error(msg);
		} finally {
			setLoading(false);
		}
	};

	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		await requestAccessCode();
	};

	const handleResendCode = async () => {
		setVerificationCode('');
		await requestAccessCode();
	};

	const handleVerifyCode = async (e: React.FormEvent) => {
		e.preventDefault();

		setError('');
		setLoading(true);

		try {
			const res = await fetch('/api/access-requests/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					requestId,
					code: verificationCode,
				}),
			});

			const data = (await res.json()) as {
				error?: string;
			};

			if (!res.ok) {
				throw new Error(
					data.error || 'No se pudo verificar el codigo.'
				);
			}

			setSuccess(true);
			setAwaitingCode(false);

			toast.success(t('registerSuccess'));

			setNombre('');
			setEmail('');
			setTelefono('');
			setMensaje('');
			setVerificationCode('');
			setRequestId('');
		} catch (err) {
			const msg =
				err instanceof Error
					? err.message
					: 'No se pudo verificar el codigo.';

			setError(msg);
			toast.error(msg);
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-black dark:text-white">
			<Toaster position="top-right" richColors />

			<div className="fixed left-0 top-0 z-30 w-full">
				<PublicNavbar />
			</div>

			<div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_18%_20%,rgba(234,179,8,0.22),transparent_28%),radial-gradient(circle_at_84%_26%,rgba(59,130,246,0.14),transparent_32%),linear-gradient(135deg,#fff7ed_0%,#f8fafc_48%,#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_18%_20%,rgba(250,204,21,0.22),transparent_28%),radial-gradient(circle_at_84%_26%,rgba(239,68,68,0.18),transparent_32%),linear-gradient(135deg,#030303_0%,#111111_48%,#1c0f0b_100%)]" />

			<div className="absolute inset-0 z-0 opacity-50 [background-image:linear-gradient(rgba(15,23,42,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.07)_1px,transparent_1px)] [background-size:72px_72px] dark:opacity-40 dark:[background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)]" />

			<section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 pb-8 pt-24 sm:px-6 sm:pt-28 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)] lg:items-center lg:gap-16 lg:px-12 xl:gap-24 xl:px-16">
				<div className="hidden w-full max-w-2xl lg:block lg:pl-4 xl:pl-8">
					<p className="mb-5 text-sm font-semibold uppercase tracking-[0.32em] text-amber-500 dark:text-yellow-300">
						SOLICITUD DE ACCESO
					</p>

					<h1 className="text-5xl font-extrabold leading-tight text-slate-950 xl:text-[3.5rem] dark:text-white">
						Activa tu espacio para verificar y gestionar DTE.
					</h1>

					<p className="mt-6 max-w-xl text-lg leading-7 text-slate-600 dark:text-zinc-300">
						Completa tus datos y revisaremos la solicitud para habilitar una cuenta segura para tu equipo.
					</p>

					<div className="mt-10 space-y-4">
						<div className="flex gap-4 rounded-xl border border-slate-200 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
							<ClipboardCheck className="mt-1 size-6 shrink-0 text-amber-500 dark:text-yellow-300" />

							<div>
								<h2 className="font-bold text-slate-950 dark:text-white">
									1. Envia tu solicitud
								</h2>

								<p className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
									Registramos tus datos de contacto y el contexto de uso.
								</p>
							</div>
						</div>

						<div className="flex gap-4 rounded-xl border border-slate-200 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
							<ShieldCheck className="mt-1 size-6 shrink-0 text-amber-500 dark:text-yellow-300" />

							<div>
								<h2 className="font-bold text-slate-950 dark:text-white">
									2. Validamos el acceso
								</h2>

								<p className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
									El equipo administrador revisa la solicitud y asigna permisos.
								</p>
							</div>
						</div>

						<div className="flex gap-4 rounded-xl border border-slate-200 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
							<FileText className="mt-1 size-6 shrink-0 text-amber-500 dark:text-yellow-300" />

							<div>
								<h2 className="font-bold text-slate-950 dark:text-white">
									3. Empiezas a operar
								</h2>

								<p className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
									Accede a validaciones, reportes y conciliaciones desde un solo lugar.
								</p>
							</div>
						</div>
					</div>
				</div>

				<Card className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white/90 text-slate-950 shadow-2xl shadow-black/20 backdrop-blur dark:border-white/10 dark:bg-zinc-950/90 dark:text-white dark:shadow-black/40">
					<CardHeader className="space-y-4 p-5 sm:p-6">
						<div className="flex size-12 items-center justify-center rounded-xl bg-yellow-400 text-black shadow-lg shadow-yellow-500/20 sm:size-14">
							<UserPlus className="size-6 sm:size-7" />
						</div>

						<div>
							<CardTitle className="text-2xl font-bold text-slate-950 sm:text-3xl dark:text-white">
								{t('registerTitle')}
							</CardTitle>

							<CardDescription className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-300">
								{t('registerDescription')}
							</CardDescription>
						</div>
					</CardHeader>

					<CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
						<form
							onSubmit={
								awaitingCode
									? handleVerifyCode
									: handleRegister
							}
							className="space-y-4"
						>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="nombre">
										{t('name')}
									</Label>

									<Input
										id="nombre"
										type="text"
										value={nombre}
										onChange={(e) =>
											setNombre(e.target.value)
										}
										placeholder={t('registerNamePlaceholder')}
										className="h-12 rounded-xl"
										required
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="telefono">
										{t('phone')}
									</Label>

									<Input
										id="telefono"
										type="tel"
										inputMode="numeric"
										maxLength={9}
										value={telefono}
										onChange={(e) =>
											setTelefono(
												formatPhone(e.target.value)
											)
										}
										placeholder={t('registerPhonePlaceholder')}
										className="h-12 rounded-xl"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="email">
									{t('email')}
								</Label>

								<Input
									id="email"
									type="email"
									value={email}
									onChange={(e) =>
										setEmail(e.target.value)
									}
									placeholder={t('registerEmailPlaceholder')}
									className="h-12 rounded-xl"
									required
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="mensaje">
									{t('message')}
								</Label>

								<Input
									id="mensaje"
									type="text"
									value={mensaje}
									onChange={(e) =>
										setMensaje(e.target.value)
									}
									placeholder={t('registerMessagePlaceholder')}
									className="h-12 rounded-xl"
								/>
							</div>

							{awaitingCode && (
								<div className="space-y-2">
									<Label htmlFor="verificationCode">
										Codigo de verificacion
									</Label>

									<Input
										id="verificationCode"
										type="text"
										inputMode="numeric"
										maxLength={6}
										value={verificationCode}
										onChange={(e) =>
											setVerificationCode(
												e.target.value.replace(
													/\D/g,
													''
												)
											)
										}
										placeholder={t(
											'registerVerificationCodePlaceholder'
										)}
										className="h-12 rounded-xl"
										required
									/>

									<div className="flex flex-col gap-2 text-sm text-slate-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
										<span>El codigo expira en 10 minutos.</span>

										<button
											type="button"
											onClick={handleResendCode}
											disabled={loading}
											className="text-left font-semibold text-amber-600 transition hover:text-amber-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-yellow-300 dark:hover:text-yellow-200 sm:text-right"
										>
											Reenviar codigo
										</button>
									</div>
								</div>
							)}

							{error && (
								<div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
									{error}
								</div>
							)}

							{success && (
								<div className="rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200">
									{t('registerSuccess')}
								</div>
							)}

							<Button
								type="submit"
								className="h-12 w-full rounded-xl bg-yellow-400 font-bold text-black hover:bg-yellow-300"
								disabled={loading}
							>
								{loading
									? t('loading')
									: awaitingCode
										? t('verifyEmailButton')
										: t('registerSubmit')}

								{!loading && (
									<ArrowRight className="size-4" />
								)}
							</Button>
						</form>

						<div className="mt-6 text-center text-sm text-slate-500 dark:text-zinc-400">
							<Link
								href="/login"
								className="font-semibold text-amber-500 hover:text-amber-400 dark:text-yellow-300 dark:hover:text-yellow-200"
							>
								{t('loginLink')}
							</Link>
						</div>
					</CardContent>
				</Card>
			</section>
		</main>
	);
}
