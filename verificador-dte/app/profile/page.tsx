'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import {
	EmailAuthProvider,
	onAuthStateChanged,
	reauthenticateWithCredential,
	updatePassword,
} from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
	KeyRound,
	Loader2,
	ShieldCheck,
	ShieldOff,
	Upload,
	UserRound,
	X,
} from 'lucide-react';

import { auth, storage } from '@/lib/firebase';
import { AppUser, getUser, updateUser } from '@/lib/firestoreUser';
import { QUERY_CACHE_MS } from '@/components/QueryProvider';

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const QRCodeSVG = dynamic(
	() => import('qrcode.react').then((m) => ({ default: m.QRCodeSVG })),
	{ ssr: false }
);

export default function ProfilePage() {
	const [user, setUser] = useState<AppUser | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [photoFile, setPhotoFile] = useState<File | null>(null);
	const [photoPreview, setPhotoPreview] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		displayName: '',
		phoneNumber: '',
		company: '',
	});
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	const [pwData, setPwData] = useState({
		current: '',
		next: '',
		confirm: '',
	});
	const [pwError, setPwError] = useState('');
	const [pwSuccess, setPwSuccess] = useState('');
	const [pwSaving, setPwSaving] = useState(false);

	const [totpEnrolled, setTotpEnrolled] = useState(false);
	const [totpUri, setTotpUri] = useState('');
	const [totpCode, setTotpCode] = useState('');
	const [totpError, setTotpError] = useState('');
	const [totpSuccess, setTotpSuccess] = useState('');
	const [totpLoading, setTotpLoading] = useState(false);
	const [totpSetupMode, setTotpSetupMode] = useState(false);

	const router = useRouter();
	const queryClient = useQueryClient();

	useEffect(() => {
		const unsubAuth = onAuthStateChanged(auth, async (authUser) => {
			if (!authUser) {
				router.push('/login');
				return;
			}

			const appUser = await queryClient.fetchQuery({
				queryKey: ['users', authUser.uid],
				queryFn: () => getUser(authUser.uid),
				staleTime: QUERY_CACHE_MS,
				gcTime: QUERY_CACHE_MS,
			});

			if (appUser) {
				setUser(appUser);
				setFormData({
					displayName: appUser.displayName || '',
					phoneNumber: appUser.phoneNumber || '',
					company: appUser.company || '',
				});

				if (appUser.photoURL) {
					setPhotoPreview(appUser.photoURL);
				}

				setTotpEnrolled(appUser.totpEnabled ?? false);
			}

			setLoading(false);
		});

		return () => unsubAuth();
	}, [queryClient, router]);

	const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];

		if (!file) return;

		if (!file.type.startsWith('image/')) {
			setError('Por favor selecciona un archivo de imagen');
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			setError('La imagen no debe pesar más de 5MB');
			return;
		}

		setPhotoFile(file);

		const reader = new FileReader();
		reader.onload = (e) => setPhotoPreview(e.target?.result as string);
		reader.readAsDataURL(file);

		setError('');
	};

	const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handlePwChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setPwData((prev) => ({ ...prev, [name]: value }));
	};

	const handlePwSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		setPwError('');
		setPwSuccess('');

		if (pwData.next.length < 6) {
			setPwError('La nueva contraseña debe tener al menos 6 caracteres');
			return;
		}

		if (pwData.next !== pwData.confirm) {
			setPwError('Las contraseñas no coinciden');
			return;
		}

		const currentUser = auth.currentUser;

		if (!currentUser || !currentUser.email) return;

		setPwSaving(true);

		try {
			const credential = EmailAuthProvider.credential(
				currentUser.email,
				pwData.current
			);

			await reauthenticateWithCredential(currentUser, credential);
			await updatePassword(currentUser, pwData.next);

			const hadMandatoryChange = Boolean(user?.mustChangePassword);

			if (hadMandatoryChange && user) {
				await updateUser(user.uid, { mustChangePassword: false });

				await queryClient.invalidateQueries({
					queryKey: ['users', user.uid],
				});

				setUser((current) =>
					current ? { ...current, mustChangePassword: false } : current
				);
			}

			setPwData({
				current: '',
				next: '',
				confirm: '',
			});

			setPwSuccess('Contraseña actualizada correctamente');

			setTimeout(() => setPwSuccess(''), 3000);

			if (hadMandatoryChange && user?.role === 'cliente') {
				try {
					const token = await auth.currentUser?.getIdToken();
					if (token) {
						const res = await fetch('/api/organization/me', {
							headers: { Authorization: `Bearer ${token}` },
						});
						const data = await res.json();
						if (!data.organization?.kyc?.kycCompleted) {
							router.replace('/onboarding');
							return;
						}
					}
				} catch {
					router.replace('/onboarding');
					return;
				}
			}
		} catch (err: unknown) {
			const msg =
				err instanceof Error ? err.message : 'Error al cambiar la contraseña';

			if (msg.includes('wrong-password') || msg.includes('invalid-credential')) {
				setPwError('La contraseña actual es incorrecta');
			} else {
				setPwError(msg);
			}
		} finally {
			setPwSaving(false);
		}
	};

	const handleStartTotpSetup = async () => {
		setTotpError('');
		setTotpSuccess('');
		setTotpLoading(true);

		try {
			const currentUser = auth.currentUser;

			if (!currentUser) throw new Error('No autenticado');

			const idToken = await currentUser.getIdToken();

			const res = await fetch('/api/totp/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({
					uid: currentUser.uid,
					email: currentUser.email,
				}),
			});

			const data = (await res.json()) as {
				otpauthUrl?: string;
				error?: string;
			};

			if (!res.ok) throw new Error(data.error ?? 'Error al generar TOTP');

			setTotpUri(data.otpauthUrl!);
			setTotpSetupMode(true);
		} catch (err: unknown) {
			setTotpError(
				err instanceof Error
					? err.message
					: 'Error al iniciar configuración TOTP'
			);
		} finally {
			setTotpLoading(false);
		}
	};

	const handleVerifyTotp = async (e: React.FormEvent) => {
		e.preventDefault();

		setTotpError('');
		setTotpLoading(true);

		try {
			const currentUser = auth.currentUser;

			if (!currentUser) throw new Error('No autenticado');

			const idToken = await currentUser.getIdToken();

			const res = await fetch('/api/totp/verify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({
					uid: currentUser.uid,
					code: totpCode,
				}),
			});

			const data = (await res.json()) as {
				success?: boolean;
				error?: string;
			};

			if (!res.ok) throw new Error(data.error ?? 'Código incorrecto');

			setTotpEnrolled(true);
			setTotpSetupMode(false);
			setTotpCode('');
			setTotpUri('');
			setTotpSuccess('Autenticación TOTP activada correctamente');

			setTimeout(() => setTotpSuccess(''), 3000);
		} catch (err: unknown) {
			setTotpError(err instanceof Error ? err.message : 'Código incorrecto');
		} finally {
			setTotpLoading(false);
		}
	};

	const handleUnenrollTotp = async () => {
		setTotpError('');
		setTotpLoading(true);

		try {
			const currentUser = auth.currentUser;

			if (!currentUser) throw new Error('No autenticado');

			const idToken = await currentUser.getIdToken();

			const res = await fetch('/api/totp/disable', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({
					uid: currentUser.uid,
				}),
			});

			const data = (await res.json()) as {
				success?: boolean;
				error?: string;
			};

			if (!res.ok) throw new Error(data.error ?? 'Error al desactivar TOTP');

			setTotpEnrolled(false);
			setTotpSuccess('TOTP desactivado correctamente');

			setTimeout(() => setTotpSuccess(''), 3000);
		} catch (err: unknown) {
			setTotpError(
				err instanceof Error ? err.message : 'Error al desactivar TOTP'
			);
		} finally {
			setTotpLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!user) return;

		if (!storage) {
			setError('Error: Storage no está configurado correctamente');
			return;
		}

		setSaving(true);
		setError('');
		setSuccess('');

		try {
			let photoURL = user.photoURL;

			if (photoFile) {
				try {
					const photoRef = ref(
						storage,
						`profile-photos/${user.uid}/${Date.now()}-${photoFile.name}`
					);

					const snapshot = await uploadBytes(photoRef, photoFile);
					photoURL = await getDownloadURL(snapshot.ref);
				} catch (uploadErr: unknown) {
					const errorMsg =
						uploadErr instanceof Error
							? uploadErr.message
							: typeof uploadErr === 'object' &&
								  uploadErr !== null &&
								  'code' in uploadErr
								? String(uploadErr.code)
								: String(uploadErr);

					console.error('Error al subir foto:', errorMsg);
					setError(`Error al subir la foto: ${errorMsg}`);
					setSaving(false);
					return;
				}
			}

			await updateUser(user.uid, {
				...user,
				displayName: formData.displayName,
				phoneNumber: formData.phoneNumber,
				company: formData.company,
				photoURL,
			});

			await queryClient.invalidateQueries({
				queryKey: ['users', user.uid],
			});

			await queryClient.invalidateQueries({
				queryKey: ['users'],
			});

			setPhotoFile(null);
			setSuccess('Perfil actualizado correctamente');

			setTimeout(() => setSuccess(''), 3000);
		} catch (err) {
			console.error('Error al guardar perfil:', err);
			setError(err instanceof Error ? err.message : 'Error al guardar el perfil');
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-background text-foreground">
				<section
					aria-label="Cargando perfil"
					className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 shadow-xl"
				>
					<Loader2 className="size-8 animate-spin text-amber-500 dark:text-yellow-300" />
					<p className="text-sm text-muted-foreground">Cargando perfil...</p>
				</section>
			</main>
		);
	}

	if (!user) {
		return null;
	}

	return (
		<main className="min-h-screen overflow-x-hidden bg-background px-0 py-2 text-foreground">
			<div className="w-full max-w-[92rem]">
				<header className="mb-4 rounded-2xl border border-border bg-card p-5 shadow-xl">
					<p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-600 dark:text-yellow-300">
						Configuración de cuenta
					</p>

					<h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
						Perfil personal
					</h1>

					<p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
						Administra tu información, foto de perfil, contraseña y seguridad de dos factores.
					</p>
				</header>

				<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
					<div className="space-y-4">
						<section aria-labelledby="profile-info-title">
							<Card className="rounded-2xl border border-border bg-card text-card-foreground shadow-xl">
								<CardHeader className="p-4">
									<CardTitle
										id="profile-info-title"
										className="flex items-center gap-2 text-foreground"
									>
										<UserRound className="size-5 text-amber-600 dark:text-yellow-300" />
										Información del perfil
									</CardTitle>

									<CardDescription className="text-muted-foreground">
										Actualiza tus datos visibles dentro de la plataforma.
									</CardDescription>
								</CardHeader>

								<CardContent className="p-4 pt-0">
									<form onSubmit={handleSubmit} className="space-y-4">
										<section
											aria-labelledby="profile-photo-title"
											className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center"
										>
											<div className="relative mx-auto size-24 shrink-0 overflow-hidden rounded-full border-4 border-muted bg-muted shadow-lg sm:mx-0">
												{photoPreview ? (
													<Image
														src={photoPreview}
														alt="Foto de perfil"
														fill
														className="object-cover"
													/>
												) : (
													<div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
														Sin foto
													</div>
												)}
											</div>

											<div className="w-full space-y-3">
												<div>
													<h2
														id="profile-photo-title"
														className="text-sm font-semibold text-foreground"
													>
														Foto de perfil
													</h2>

													<p className="mt-1 text-xs text-muted-foreground">
														Usa una imagen JPG o PNG. Máximo 5MB.
													</p>
												</div>

												<div className="flex flex-col gap-2 sm:flex-row">
													<label className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted">
														<Upload className="size-4" />
														Subir foto
														<input
															id="photo"
															type="file"
															accept="image/*"
															onChange={handlePhotoChange}
															className="hidden"
														/>
													</label>

													{photoFile && (
														<button
															type="button"
															aria-label="Cancelar cambio de foto"
															onClick={() => {
																setPhotoFile(null);
																setPhotoPreview(user.photoURL || null);
															}}
															className="flex h-11 items-center justify-center rounded-xl border border-border bg-background px-4 text-foreground transition hover:bg-muted"
														>
															<X className="size-4" />
														</button>
													)}
												</div>
											</div>
										</section>

										<section
											aria-labelledby="profile-fields-title"
											className="space-y-4"
										>
											<h2 id="profile-fields-title" className="sr-only">
												Datos personales
											</h2>

											<div className="grid gap-4 md:grid-cols-2">
												<div className="space-y-2 md:col-span-2">
													<Label htmlFor="email" className="text-foreground">
														Email
													</Label>
													<Input
														id="email"
														type="email"
														value={user.email}
														disabled
														className="h-12 rounded-xl border-border bg-background text-muted-foreground"
													/>
												</div>

												<div className="space-y-2">
													<Label htmlFor="displayName" className="text-foreground">
														Nombre completo
													</Label>
													<Input
														id="displayName"
														name="displayName"
														type="text"
														placeholder="Juan Pérez"
														value={formData.displayName}
														onChange={handleFormChange}
														className="h-12 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground"
													/>
												</div>

												<div className="space-y-2">
													<Label htmlFor="phoneNumber" className="text-foreground">
														Teléfono
													</Label>
													<Input
														id="phoneNumber"
														name="phoneNumber"
														type="tel"
														placeholder="+503 1234 5678"
														value={formData.phoneNumber}
														onChange={handleFormChange}
														className="h-12 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground"
													/>
												</div>

												<div className="space-y-2">
													<Label htmlFor="company" className="text-foreground">
														Empresa
													</Label>
													<Input
														id="company"
														name="company"
														type="text"
														placeholder="Nombre de la empresa"
														value={formData.company}
														onChange={handleFormChange}
														className="h-12 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground"
													/>
												</div>

												<div className="space-y-2">
													<Label htmlFor="role" className="text-foreground">
														Rol
													</Label>
													<Input
														id="role"
														type="text"
														value={
															user.role === 'superadmin'
																? 'Administrador'
																: user.role === 'cliente'
																	? 'Cliente'
																	: 'Colaborador'
														}
														disabled
														className="h-12 rounded-xl border-border bg-background text-muted-foreground"
													/>
												</div>
											</div>
										</section>

										{error && (
											<p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
												{error}
											</p>
										)}

										{success && (
											<p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
												{success}
											</p>
										)}

										<Button
											type="submit"
											disabled={saving}
											className="h-12 w-full rounded-xl bg-yellow-400 font-bold text-black hover:bg-yellow-300"
										>
											{saving ? (
												<>
													<Loader2 className="mr-2 size-4 animate-spin" />
													Guardando...
												</>
											) : (
												'Guardar cambios'
											)}
										</Button>
									</form>
								</CardContent>
							</Card>
						</section>

						<section aria-labelledby="password-title">
							<Card className="rounded-2xl border border-border bg-card text-card-foreground shadow-xl">
								<CardHeader className="p-4">
									<CardTitle
										id="password-title"
										className="flex items-center gap-2 text-foreground"
									>
										<KeyRound className="size-5 text-amber-600 dark:text-yellow-300" />
										Cambiar contraseña
									</CardTitle>

									<CardDescription className="text-muted-foreground">
										Introduce tu contraseña actual y la nueva para actualizarla.
									</CardDescription>
								</CardHeader>

								<CardContent className="p-4 pt-0">
									<form onSubmit={handlePwSubmit} className="space-y-4">
										<div className="space-y-2">
											<Label htmlFor="current" className="text-foreground">
												Contraseña actual
											</Label>
											<Input
												id="current"
												name="current"
												type="password"
												placeholder="••••••••"
												value={pwData.current}
												onChange={handlePwChange}
												required
												className="h-12 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground"
											/>
										</div>

										<div className="grid gap-4 md:grid-cols-2">
											<div className="space-y-2">
												<Label htmlFor="next" className="text-foreground">
													Nueva contraseña
												</Label>
												<Input
													id="next"
													name="next"
													type="password"
													placeholder="••••••••"
													value={pwData.next}
													onChange={handlePwChange}
													required
													className="h-12 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground"
												/>
											</div>

											<div className="space-y-2">
												<Label htmlFor="confirm" className="text-foreground">
													Confirmar nueva contraseña
												</Label>
												<Input
													id="confirm"
													name="confirm"
													type="password"
													placeholder="••••••••"
													value={pwData.confirm}
													onChange={handlePwChange}
													required
													className="h-12 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground"
												/>
											</div>
										</div>

										{pwError && (
											<p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
												{pwError}
											</p>
										)}

										{pwSuccess && (
											<p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
												{pwSuccess}
											</p>
										)}

										<Button
											type="submit"
											disabled={pwSaving}
											className="h-12 w-full rounded-xl bg-yellow-400 font-bold text-black hover:bg-yellow-300"
										>
											{pwSaving ? (
												<>
													<Loader2 className="mr-2 size-4 animate-spin" />
													Guardando...
												</>
											) : (
												'Actualizar contraseña'
											)}
										</Button>
									</form>
								</CardContent>
							</Card>
						</section>
					</div>

					<aside aria-labelledby="security-title" className="space-y-5">
						<Card className="rounded-2xl border border-border bg-card text-card-foreground shadow-xl">
							<CardHeader className="p-4">
								<CardTitle
									id="security-title"
									className="flex items-center gap-2 text-foreground"
								>
									{totpEnrolled ? (
										<ShieldCheck className="size-5 text-emerald-400" />
									) : (
										<ShieldOff className="size-5 text-amber-600 dark:text-yellow-300" />
									)}
									Seguridad 2FA
								</CardTitle>

								<CardDescription className="text-muted-foreground">
									{totpEnrolled
										? 'Tu cuenta tiene TOTP activo.'
										: 'Añade una capa extra de seguridad.'}
								</CardDescription>
							</CardHeader>

							<CardContent className="p-4 pt-0">
								{totpSuccess && (
									<p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
										{totpSuccess}
									</p>
								)}

								{totpError && (
									<p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
										{totpError}
									</p>
								)}

								<section aria-label="Estado de autenticación en dos factores">
									{totpEnrolled && !totpSetupMode && (
										<Button
											variant="destructive"
											onClick={handleUnenrollTotp}
											disabled={totpLoading}
											className="h-12 w-full rounded-xl"
										>
											{totpLoading ? (
												<>
													<Loader2 className="mr-2 size-4 animate-spin" />
													Desactivando...
												</>
											) : (
												<>
													<ShieldOff className="mr-2 size-4" />
													Desactivar TOTP
												</>
											)}
										</Button>
									)}

									{!totpEnrolled && !totpSetupMode && (
										<Button
											onClick={handleStartTotpSetup}
											disabled={totpLoading}
											className="h-12 w-full rounded-xl bg-yellow-400 font-bold text-black hover:bg-yellow-300"
										>
											{totpLoading ? (
												<>
													<Loader2 className="mr-2 size-4 animate-spin" />
													Iniciando...
												</>
											) : (
												<>
													<ShieldCheck className="mr-2 size-4" />
													Activar TOTP
												</>
											)}
										</Button>
									)}

									{totpSetupMode && (
										<form
											onSubmit={handleVerifyTotp}
											className="space-y-4"
											aria-label="Configurar autenticación TOTP"
										>
											<p className="text-sm leading-6 text-muted-foreground">
												Escanea el código QR con{' '}
												<strong>Google Authenticator</strong>,{' '}
												<strong>Authy</strong> u otra app TOTP, luego ingresa el código de 6 dígitos.
											</p>

											{totpUri && (
												<figure className="flex justify-center rounded-2xl border border-border bg-background p-4">
													<div className="rounded-xl bg-white p-4">
														<QRCodeSVG value={totpUri} size={180} />
													</div>

													<figcaption className="sr-only">
														Código QR para configurar autenticación TOTP.
													</figcaption>
												</figure>
											)}

											<div className="space-y-2">
												<Label htmlFor="totpCode" className="text-foreground">
													Código de verificación
												</Label>
												<Input
													id="totpCode"
													type="text"
													inputMode="numeric"
													maxLength={6}
													placeholder="123456"
													value={totpCode}
													onChange={(e) =>
														setTotpCode(e.target.value.replace(/\D/g, ''))
													}
													required
													className="h-14 rounded-xl border-border bg-background text-center text-2xl font-bold tracking-[0.35em] text-foreground placeholder:text-muted-foreground"
												/>
											</div>

											<div className="grid gap-2 sm:grid-cols-2">
												<Button
													type="button"
													variant="outline"
													className="h-12 rounded-xl border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground"
													onClick={() => {
														setTotpSetupMode(false);
														setTotpCode('');
														setTotpError('');
													}}
												>
													Cancelar
												</Button>

												<Button
													type="submit"
													disabled={totpLoading || totpCode.length !== 6}
													className="h-12 rounded-xl bg-yellow-400 font-bold text-black hover:bg-yellow-300"
												>
													{totpLoading ? (
														<>
															<Loader2 className="mr-2 size-4 animate-spin" />
															Verificando...
														</>
													) : (
														'Verificar'
													)}
												</Button>
											</div>
										</form>
									)}
								</section>
							</CardContent>
						</Card>
					</aside>
				</div>
			</div>
		</main>
	);
}
