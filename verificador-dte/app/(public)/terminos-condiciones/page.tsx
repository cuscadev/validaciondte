import PublicNavbar from '@/components/PublicNavbar';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
	title: 'Terminos y condiciones | Kaiser DTE',
	description:
		'Terminos y condiciones de uso de Kaiser DTE para verificacion, gestion e integraciones de DTE.',
	alternates: {
		canonical: '/terminos-condiciones',
	},
};

const sections = [
	{
		title: '1. Aceptacion',
		body: [
			'Al crear una cuenta, acceder o usar Kaiser DTE, el usuario acepta estos terminos y condiciones.',
			'Si actua en nombre de una empresa u organizacion, declara que cuenta con autorizacion para aceptar estos terminos por dicha entidad.',
		],
	},
	{
		title: '2. Descripcion del servicio',
		body: [
			'Kaiser DTE permite cargar, importar, verificar, organizar y procesar Documentos Tributarios Electronicos y datos relacionados.',
			'La plataforma puede incluir funciones de integracion con correo electronico, lectura de archivos JSON, almacenamiento de documentos, reportes, trazabilidad y consultas asociadas a procesos tributarios.',
		],
	},
	{
		title: '3. Cuenta y seguridad',
		body: [
			'El usuario es responsable de mantener la confidencialidad de sus credenciales y de todas las actividades realizadas desde su cuenta.',
			'Debe proporcionar informacion verdadera, mantenerla actualizada y notificar cualquier uso no autorizado o incidente de seguridad.',
		],
	},
	{
		title: '4. Integraciones de correo',
		body: [
			'Cuando el usuario conecta Gmail u otro proveedor compatible, autoriza a Kaiser DTE a acceder a la informacion estrictamente necesaria para buscar y extraer adjuntos JSON relacionados con DTE.',
			'El usuario puede desconectar la integracion cuando lo decida desde la aplicacion o desde la configuracion de permisos de su proveedor de correo.',
		],
	},
	{
		title: '5. Responsabilidades del usuario',
		body: [
			'El usuario debe usar el servicio de forma legal, respetar derechos de terceros y asegurarse de que tiene autorizacion para procesar los documentos, correos y datos que carga o sincroniza.',
			'No esta permitido intentar vulnerar la seguridad del sistema, usar la plataforma para actividades fraudulentas, cargar codigo malicioso o interferir con la operacion del servicio.',
		],
	},
	{
		title: '6. Exactitud de informacion fiscal',
		body: [
			'Kaiser DTE ayuda a organizar y procesar informacion, pero no sustituye el criterio profesional contable, tributario o legal.',
			'El usuario es responsable de revisar los resultados, validar la informacion ante fuentes oficiales cuando corresponda y cumplir sus obligaciones fiscales.',
		],
	},
	{
		title: '7. Disponibilidad y cambios',
		body: [
			'Trabajamos para mantener el servicio disponible, pero no garantizamos operacion ininterrumpida o libre de errores.',
			'Podemos modificar, suspender o retirar funciones para mejorar seguridad, rendimiento, cumplimiento legal o experiencia de usuario.',
		],
	},
	{
		title: '8. Propiedad intelectual',
		body: [
			'La plataforma, marca, interfaces, codigo, diseno y componentes del servicio pertenecen a Cuscadev o a sus respectivos licenciantes.',
			'El usuario conserva los derechos sobre los documentos y datos que carga, sujeto a las licencias necesarias para que Kaiser DTE pueda prestar el servicio.',
		],
	},
	{
		title: '9. Suspension o terminacion',
		body: [
			'Podemos suspender o terminar el acceso si detectamos incumplimiento de estos terminos, riesgos de seguridad, uso abusivo o requerimientos legales.',
			'El usuario puede dejar de usar el servicio y solicitar eliminacion de datos conforme a la politica de privacidad.',
		],
	},
	{
		title: '10. Limitacion de responsabilidad',
		body: [
			'En la medida permitida por la ley, Kaiser DTE no sera responsable por perdidas indirectas, lucro cesante, interrupciones, errores de terceros, decisiones tomadas con base en informacion no revisada o incumplimientos atribuibles al usuario.',
			'Ninguna disposicion limita responsabilidades que no puedan excluirse legalmente.',
		],
	},
	{
		title: '11. Privacidad',
		body: [
			'El tratamiento de datos personales y datos obtenidos desde integraciones se rige por nuestra Politica de privacidad.',
		],
	},
	{
		title: '12. Cambios a los terminos',
		body: [
			'Podemos actualizar estos terminos. La version vigente estara publicada en esta ruta y el uso continuo del servicio implica aceptacion de la version actualizada.',
		],
	},
];

export default function TermsPage() {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<PublicNavbar />

			<section className="mx-auto w-full max-w-4xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
				<div className="border-b border-border pb-8">
					<p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
						Kaiser DTE
					</p>
					<h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
						Terminos y condiciones
					</h1>
					<p className="mt-4 text-base leading-7 text-muted-foreground">
						Fecha de vigencia: 11 de junio de 2026.
					</p>
				</div>

				<div className="mt-10 space-y-10">
					{sections.map((section) => (
						<section key={section.title} className="space-y-4">
							<h2 className="text-xl font-bold text-foreground">
								{section.title}
							</h2>
							{section.body.map((paragraph) => (
								<p
									key={paragraph}
									className="text-base leading-8 text-muted-foreground"
								>
									{paragraph}
								</p>
							))}
						</section>
					))}

					<section className="space-y-4 border-t border-border pt-8">
						<h2 className="text-xl font-bold text-foreground">
							13. Contacto
						</h2>
						<p className="text-base leading-8 text-muted-foreground">
							Para consultas sobre estos terminos, escriba a{' '}
							<a
								href="mailto:alexanderhernandz78@gmail.com"
								className="font-semibold text-primary underline-offset-4 hover:underline"
							>
								alexanderhernandz78@gmail.com
							</a>
							.
						</p>
						<div className="flex flex-wrap gap-3 pt-2">
							<Link
								href="/politica-privacidad"
								className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
							>
								Ver politica de privacidad
							</Link>
							<Link
								href="/"
								className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
							>
								Volver al inicio
							</Link>
						</div>
					</section>
				</div>
			</section>
		</main>
	);
}
