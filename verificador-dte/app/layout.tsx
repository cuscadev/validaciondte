import './globals.css';
import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';
import { getAppFontConfig } from '@/lib/fonts/app-font';

export const metadata: Metadata = {
	metadataBase: new URL('https://verificadordtev2.cuscadev.com'),
	title: {
		default: 'Kaiser DTE | Verificación y gestión de DTE en El Salvador',
		template: '%s | Kaiser DTE',
	},
	description:
		'Plataforma para verificar, gestionar y revisar documentos tributarios electrónicos DTE en El Salvador con reportes, seguridad y control de acceso.',
	keywords: [
		'DTE El Salvador',
		'facturación electrónica El Salvador',
		'verificación DTE',
		'documentos tributarios electrónicos',
		'Hacienda El Salvador',
		'auditoría DTE',
		'validación de DTE',
		'sistema DTE El Salvador',
	],
	authors: [{ name: 'Kaiser DTE' }],
	creator: 'Kaiser DTE',
	publisher: 'Kaiser DTE',
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			'max-image-preview': 'large',
			'max-snippet': -1,
			'max-video-preview': -1,
		},
	},
	openGraph: {
		title: 'Kaiser DTE | Verificación y gestión de DTE',
		description:
			'Verifica y gestiona documentos tributarios electrónicos en El Salvador desde una plataforma segura.',
		url: 'https://verificadordtev2.cuscadev.com',
		siteName: 'Kaiser DTE',
		images: [
			{
				url: '/og-image.png',
				width: 1200,
				height: 630,
				alt: 'Kaiser DTE - Verificación y gestión de DTE en El Salvador',
			},
		],
		locale: 'es_SV',
		type: 'website',
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Kaiser DTE | Verificación y gestión de DTE',
		description:
			'Verifica y gestiona documentos tributarios electrónicos en El Salvador desde una plataforma segura.',
		images: ['/og-image.png'],
	},
	icons: {
		icon: '/icono.png',
		shortcut: '/icono.png',
		apple: '/icono.png',
	},
	alternates: {
		canonical: '/',
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { googleFontsUrl, cssVariable } = getAppFontConfig();

	return (
		<html
			lang="es-SV"
			suppressHydrationWarning
			style={{ ['--app-font-family' as string]: cssVariable }}
		>
			<head>
				{googleFontsUrl ? (
					<link rel="stylesheet" href={googleFontsUrl} />
				) : null}
			</head>
			<body className="min-h-screen font-sans">
				<AppShell>{children}</AppShell>
			</body>
		</html>
	);
}
