import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Kaiser DTE | Verificador de DTEs en El Salvador',
	description:
		'Verifica, valida y gestiona Documentos Tributarios Electronicos en El Salvador con Kaiser DTE. Procesa JSON, consulta estados y organiza reportes fiscales.',
	alternates: {
		canonical: '/',
	},
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
		title: 'Kaiser DTE | Verificador de DTEs en El Salvador',
		description:
			'Plataforma para verificar y gestionar documentos tributarios electronicos en El Salvador.',
		url: '/',
		siteName: 'Kaiser DTE',
		locale: 'es_SV',
		type: 'website',
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Kaiser DTE | Verificador de DTEs en El Salvador',
		description:
			'Verifica y gestiona DTEs en El Salvador desde una plataforma segura.',
	},
};

export default function PublicLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
