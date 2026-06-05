'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { FadeIn } from '@/components/motion/FadeIn';
import {
	ArrowRight,
	BadgeCheck,
	FileSearch,
	LockKeyhole,
	ShieldCheck,
	UploadCloud,
	Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import PublicNavbar from '@/components/PublicNavbar';
import PricingSection from '@/components/PricingSection';
import { Button } from '@/components/ui/button';

const ThreeLandingScene = dynamic(
	() => import('@/components/ThreeLandingScene'),
	{
		ssr: false,
		loading: () => null,
	}
);

const structuredData = {
	'@context': 'https://schema.org',
	'@type': 'SoftwareApplication',
	name: 'Kaiser DTE',
	applicationCategory: 'BusinessApplication',
	operatingSystem: 'Web',
	url: 'https://verificadordtev2.cuscadev.com',
	description:
		'Plataforma web para verificar, validar y gestionar Documentos Tributarios Electronicos DTE en El Salvador.',
	offers: {
		'@type': 'Offer',
		price: '0',
		priceCurrency: 'USD',
	},
	areaServed: {
		'@type': 'Country',
		name: 'El Salvador',
	},
	publisher: {
		'@type': 'Organization',
		name: 'Kaiser DTE',
		url: 'https://verificadordtev2.cuscadev.com',
	},
};

export default function LandingPage() {
	const { t } = useTranslation();

	useEffect(() => {
		fetch('/api/landing-visits', {
			method: 'POST',
			headers: {
				'x-landing-visit': 'kaiser-dte-landing',
			},
			keepalive: true,
		}).catch(() => {});
	}, []);

	const flowItems = [
		{
			title: t('landing.flow.upload.title'),
			description: t('landing.flow.upload.description'),
			icon: UploadCloud,
		},
		{
			title: t('landing.flow.validate.title'),
			description: t('landing.flow.validate.description'),
			icon: FileSearch,
		},
		{
			title: t('landing.flow.report.title'),
			description: t('landing.flow.report.description'),
			icon: BadgeCheck,
		},
	];

	const capabilityItems = [
		t('landing.capabilities.item1'),
		t('landing.capabilities.item2'),
		t('landing.capabilities.item3'),
		t('landing.capabilities.item4'),
		t('landing.capabilities.item5'),
		t('landing.capabilities.item6'),
	];

	return (
		<main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-black dark:text-white">
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(structuredData),
				}}
			/>

			<div className="fixed left-0 top-0 z-30 w-full">
				<PublicNavbar />
			</div>

			<section
				id="inicio"
				aria-labelledby="landing-title"
				className="relative flex min-h-screen w-full items-center overflow-hidden px-4 pb-16 pt-28 sm:px-6 md:px-10 lg:px-16"
			>
				<div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_18%_20%,rgba(234,179,8,0.22),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(59,130,246,0.16),transparent_30%),linear-gradient(135deg,#fff7ed_0%,#f8fafc_48%,#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_18%_20%,rgba(250,204,21,0.22),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(239,68,68,0.18),transparent_30%),linear-gradient(135deg,#030303_0%,#111111_48%,#1c0f0b_100%)]" />

				<div className="absolute inset-0 z-0 opacity-55 [background-image:linear-gradient(rgba(15,23,42,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.07)_1px,transparent_1px)] [background-size:72px_72px] dark:opacity-45 dark:[background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)]" />

				<div className="absolute inset-y-0 left-0 z-0 hidden w-[58vw] bg-gradient-to-r from-white/82 via-white/44 to-transparent md:block dark:hidden" />

				<div className="pointer-events-none absolute right-[3vw] top-1/2 z-0 hidden h-[76vh] max-h-[820px] min-h-[480px] w-[58vw] min-w-[700px] -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.46)_34%,rgba(234,179,8,0.13)_52%,transparent_72%)] md:block dark:hidden" />

				<div className="absolute inset-y-0 right-0 z-0 hidden h-full w-[64vw] min-w-[760px] opacity-100 drop-shadow-[0_32px_80px_rgba(15,23,42,0.2)] md:block dark:drop-shadow-none">
					<ThreeLandingScene />
				</div>

				<FadeIn
					className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8 text-center md:mx-0 md:ml-[5vw] md:max-w-[43rem] md:text-left lg:ml-[7vw] xl:ml-[8vw]"
					y={32}
					duration={0.9}
				>
					<div>
						<p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-amber-600 sm:text-sm dark:text-yellow-300">
							{t('landing.hero.eyebrow')}
						</p>

						<h1
							id="landing-title"
							className="text-4xl font-extrabold leading-tight text-slate-950 drop-shadow-[0_2px_18px_rgba(255,255,255,0.85)] sm:text-5xl md:text-6xl lg:text-7xl dark:text-white dark:drop-shadow-lg"
						>
							{t('landingTitle')}
						</h1>

						<p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg md:mx-0 md:text-2xl dark:text-zinc-200">
							{t('landingDescription')}
							<br className="hidden sm:block" />
							{t('landingTagline')}
						</p>
					</div>

					<div className="flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
						<Link href="/signup" aria-label="Solicitar acceso al sistema DTE">
							<Button
								size="lg"
								className="w-full bg-yellow-400 font-bold text-black hover:bg-yellow-300 sm:w-auto"
							>
								{t('registerSubmit')}
								<ArrowRight className="size-4" />
							</Button>
						</Link>

						<Link href="/login" aria-label="Iniciar sesión en el sistema DTE">
							<Button
								size="lg"
								variant="outline"
								className="w-full border-slate-300 bg-white/70 text-slate-950 hover:bg-white sm:w-auto dark:border-white/30 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
							>
								{t('login')}
							</Button>
						</Link>
					</div>
				</FadeIn>
			</section>

			<section className="relative z-10 w-full px-4 pb-16 sm:px-6 md:-mt-10 md:px-10 md:pb-20 lg:px-16">
				<div className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-3">
					{[
						{
							title: t('landing.cards.validation.title'),
							description: t('landing.cards.validation.description'),
						},
						{
							title: t('landing.cards.reports.title'),
							description: t('landing.cards.reports.description'),
						},
						{
							title: t('landing.cards.security.title'),
							description: t('landing.cards.security.description'),
						},
					].map((item, index) => (
						<FadeIn
							as="article"
							key={item.title}
							className="rounded-xl border border-slate-200 bg-white/85 p-6 text-slate-950 shadow-lg backdrop-blur dark:border-white/10 dark:bg-zinc-950/80 dark:text-gray-100"
							inView
							y={40}
							delay={index * 0.1}
							viewportAmount={0.4}
						>
							<h2 className="mb-3 text-xl font-bold text-amber-600 dark:text-yellow-300">
								{item.title}
							</h2>

							<p className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
								{item.description}
							</p>
						</FadeIn>
					))}
				</div>
			</section>

			<section
				id="proceso"
				aria-labelledby="workflow-title"
				className="relative z-10 w-full border-t border-slate-200 bg-white px-4 py-16 sm:px-6 md:px-10 md:py-20 lg:px-16 dark:border-white/10 dark:bg-black"
			>
				<div className="mx-auto max-w-6xl">
					<FadeIn className="max-w-3xl" inView y={34} viewportAmount={0.45}>
						<p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-yellow-300">
							{t('landing.workflow.eyebrow')}
						</p>

						<h2 id="workflow-title" className="text-3xl font-bold md:text-5xl">
							{t('landing.workflow.title')}
						</h2>
					</FadeIn>

					<div className="mt-12 grid gap-4 md:grid-cols-3">
						{flowItems.map((item, index) => {
							const Icon = item.icon;

							return (
								<FadeIn
									as="article"
									key={item.title}
									className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950"
									inView
									y={44}
									delay={index * 0.12}
									viewportAmount={0.35}
								>
									<div className="mb-5 flex size-11 items-center justify-center rounded-md bg-yellow-400 text-black">
										<Icon className="size-5" />
									</div>

									<h3 className="mb-3 text-xl font-bold text-slate-950 dark:text-white">
										{item.title}
									</h3>

									<p className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
										{item.description}
									</p>
								</FadeIn>
							);
						})}
					</div>
				</div>
			</section>

			<section
				id="funciones"
				aria-labelledby="capabilities-title"
				className="relative z-10 w-full bg-slate-100 px-4 py-16 sm:px-6 md:px-10 md:py-20 lg:px-16 dark:bg-zinc-950"
			>
				<div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
					<FadeIn
						inView
						viewportAmount={0.45}
						duration={0.75}
						initial={{ opacity: 0, x: -36 }}
						whileInView={{ opacity: 1, x: 0 }}
					>
						<p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-yellow-300">
							{t('landing.capabilities.eyebrow')}
						</p>

						<h2 id="capabilities-title" className="text-3xl font-bold md:text-5xl">
							{t('landing.capabilities.title')}
						</h2>

						<p className="mt-5 text-base leading-7 text-slate-600 dark:text-zinc-300">
							{t('landing.capabilities.description')}
						</p>
					</FadeIn>

					<div className="grid gap-3 sm:grid-cols-2">
						{capabilityItems.map((item, index) => (
							<FadeIn
								as="article"
								key={item}
								className="flex min-h-24 gap-4 rounded-xl border border-slate-200 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-black/60"
								inView
								y={34}
								delay={index * 0.06}
								duration={0.65}
								viewportAmount={0.35}
							>
								<ShieldCheck className="mt-1 size-5 shrink-0 text-amber-600 dark:text-yellow-300" />

								<p className="text-sm leading-6 text-slate-700 dark:text-zinc-200">
									{item}
								</p>
							</FadeIn>
						))}
					</div>
				</div>
			</section>

			<section className="relative z-10 w-full bg-white px-4 py-16 sm:px-6 md:px-10 md:py-20 lg:px-16 dark:bg-black">
				<div className="mx-auto max-w-6xl">
					<div className="max-w-3xl">
						<p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-yellow-300">
							 DTE El Salvador
						</p>
						<h2 className="text-3xl font-bold md:text-5xl">
							Sistema de verificacion y gestion de DTE en El Salvador
						</h2>
						<p className="mt-5 text-base leading-8 text-slate-700 dark:text-zinc-300">
							Verifica documentos tributarios electronicos, consulta DTE con Hacienda, gestiona auditorias y controla comprobantes electronicos desde una plataforma orientada a empresas, despachos contables y equipos de cumplimiento tributario.
						</p>
					</div>

					<div className="mt-10 grid gap-4 md:grid-cols-2">
						{[
							{
								title: 'Que es un DTE',
								description:
									'Un Documento Tributario Electronico es un comprobante fiscal digital usado en El Salvador para respaldar operaciones comerciales. Puede incluir codigo de generacion, fecha de emision, emisor, receptor, montos y sello relacionado con Hacienda.',
								href: '/facturacion-electronica',
							},
							{
								title: 'Como verificar un DTE',
								description:
									'Para verificar un DTE se revisan datos como codigo de generacion, fecha de emision, ambiente y contenido fiscal del documento. Kaiser DTE ayuda a ordenar esta informacion y reducir revision manual.',
								href: '/verificacion-dte',
							},
							{
								title: 'Como validar documentos con Hacienda',
								description:
									'La validacion con Hacienda puede apoyarse en enlaces o codigos QR de consulta publica. La plataforma genera referencias de consulta y ayuda a controlar resultados por documento.',
								href: '/consulta-hacienda',
							},
							{
								title: 'Auditoria DTE para empresas',
								description:
									'Los equipos contables y auditores pueden usar reportes y extraccion de datos para revisar compras, ventas, sujetos excluidos, liquidaciones y comprobantes relacionados.',
								href: '/auditoria-dte',
							},
						].map((item) => (
							<article
								key={item.title}
								className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950"
							>
								<h3 className="text-xl font-bold text-slate-950 dark:text-white">{item.title}</h3>
								<p className="mt-3 text-sm leading-7 text-slate-700 dark:text-zinc-300">
									{item.description}
								</p>
								<Link
									href={item.href}
									className="mt-5 inline-flex text-sm font-semibold text-amber-700 hover:text-amber-600 dark:text-yellow-300"
								>
									Leer mas
								</Link>
							</article>
						))}
					</div>
				</div>
			</section>

			<PricingSection />

			<section className="relative z-10 w-full overflow-hidden bg-white px-4 py-16 sm:px-6 md:px-10 md:py-20 lg:px-16 dark:bg-black">
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(234,179,8,0.16),transparent_28%),radial-gradient(circle_at_80%_70%,rgba(59,130,246,0.13),transparent_32%)] dark:bg-[radial-gradient(circle_at_18%_30%,rgba(250,204,21,0.14),transparent_28%),radial-gradient(circle_at_80%_70%,rgba(239,68,68,0.13),transparent_32%)]" />

				<div className="relative mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
					<FadeIn
						as="article"
						className="rounded-xl border border-slate-200 bg-white/80 p-7 shadow-lg backdrop-blur dark:border-white/10 dark:bg-zinc-950/80"
						inView
						y={42}
						viewportAmount={0.35}
					>
						<LockKeyhole className="mb-5 size-8 text-amber-600 dark:text-yellow-300" />

						<h3 className="mb-3 text-xl font-bold">
							{t('landing.bottom.security.title')}
						</h3>

						<p className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
							{t('landing.bottom.security.description')}
						</p>
					</FadeIn>

					<FadeIn
						as="article"
						className="rounded-xl border border-slate-200 bg-white/80 p-7 shadow-lg backdrop-blur dark:border-white/10 dark:bg-zinc-950/80"
						inView
						y={42}
						delay={0.12}
						viewportAmount={0.35}
					>
						<Users className="mb-5 size-8 text-amber-600 dark:text-yellow-300" />

						<h3 className="mb-3 text-xl font-bold">
							{t('landing.bottom.collaboration.title')}
						</h3>

						<p className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
							{t('landing.bottom.collaboration.description')}
						</p>
					</FadeIn>

					<FadeIn
						as="article"
						className="rounded-xl border border-yellow-300/40 bg-yellow-300 p-7 text-black"
						inView
						y={42}
						delay={0.24}
						viewportAmount={0.35}
					>
						<h3 className="mb-3 text-2xl font-extrabold">
							{t('landing.cta.title')}
						</h3>

						<p className="mb-6 text-sm leading-6 text-zinc-900">
							{t('landing.cta.description')}
						</p>

						<Link href="/signup" aria-label="Solicitar acceso a la plataforma DTE">
							<Button
								size="lg"
								className="bg-black font-bold text-white hover:bg-zinc-800"
							>
								{t('registerSubmit')}
								<ArrowRight className="size-4" />
							</Button>
						</Link>
					</FadeIn>
				</div>
			</section>
		</main>
	);
}
