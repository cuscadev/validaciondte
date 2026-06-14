import PublicNavbar from '@/components/PublicNavbar';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
	title: 'Politica de privacidad | Kaiser DTE',
	description:
		'Politica de privacidad de Kaiser DTE para usuarios, integraciones de Gmail y tratamiento de datos de DTE.',
	alternates: {
		canonical: '/politica-privacidad',
	},
};

const sections = [
	{
		title: '1. Quienes somos',
		body: [
			'Kaiser DTE es una plataforma web operada por Cuscadev para verificar, organizar y procesar Documentos Tributarios Electronicos en El Salvador.',
			'Esta politica explica que informacion recopilamos, como la usamos y que opciones tiene el usuario sobre sus datos.',
		],
	},
	{
		title: '2. Informacion que recopilamos',
		body: [
			'Podemos recopilar datos de cuenta, como nombre, correo electronico, organizacion, preferencias de idioma, configuracion y datos de autenticacion.',
			'Cuando el usuario carga o sincroniza documentos, podemos almacenar archivos JSON de DTE, codigos de generacion, datos fiscales contenidos en el documento, resultados de verificacion, historial de procesamiento y metadatos operativos necesarios para prestar el servicio.',
		],
	},
	{
		title: '3. Integracion con Gmail',
		body: [
			'Si el usuario conecta una cuenta de Gmail, Kaiser DTE solicita acceso para leer correos con el objetivo de encontrar adjuntos JSON relacionados con DTE y extraerlos para su procesamiento.',
			'De esos correos podemos guardar metadatos utiles para trazabilidad, incluyendo remitente, destinatarios, asunto, fecha y hora, identificador del mensaje, identificador del hilo, nombre del adjunto, hash del archivo y estado de importacion.',
			'No enviamos correos en nombre del usuario ni modificamos su buzon de Gmail.',
		],
	},
	{
		title: '4. Uso de datos de Google y Limited Use',
		body: [
			'El uso y transferencia de informacion recibida de las APIs de Google cumple con la Politica de Datos de Usuario de los Servicios API de Google, incluyendo los requisitos de Limited Use.',
			'Los datos obtenidos desde Gmail se usan unicamente para mostrar, extraer, guardar, verificar y procesar documentos DTE solicitados por el usuario.',
			'No vendemos datos de Google, no los usamos para publicidad, no los usamos para entrenar modelos de inteligencia artificial de uso general y no permitimos acceso humano salvo cuando sea necesario para soporte, seguridad, cumplimiento legal o cuando el usuario lo autorice.',
		],
	},
	{
		title: '5. Como usamos la informacion',
		body: [
			'Usamos la informacion para autenticar usuarios, prestar el servicio, verificar documentos, mostrar historial, generar reportes, prevenir abuso, mejorar la estabilidad de la plataforma y cumplir obligaciones legales o de seguridad.',
			'Tambien podemos usar datos tecnicos agregados o anonimizados para medir rendimiento y corregir errores.',
		],
	},
	{
		title: '6. Almacenamiento y seguridad',
		body: [
			'Kaiser DTE utiliza servicios de infraestructura como Firebase y Vercel para autenticacion, base de datos, almacenamiento y despliegue de la aplicacion.',
			'Los documentos y metadatos se asocian al usuario u organizacion autenticada. Aplicamos controles de acceso, cifrado de tokens de integracion y medidas razonables para proteger la informacion.',
		],
	},
	{
		title: '7. Comparticion de datos',
		body: [
			'Podemos compartir datos con proveedores que ayudan a operar el servicio, como Google/Firebase, Vercel y servicios necesarios para verificar o procesar DTE.',
			'No compartimos informacion personal con terceros para fines comerciales independientes.',
		],
	},
	{
		title: '8. Retencion y eliminacion',
		body: [
			'Conservamos los datos mientras la cuenta este activa o mientras sean necesarios para prestar el servicio, resolver incidencias, mantener trazabilidad o cumplir requisitos legales.',
			'El usuario puede solicitar eliminacion de datos o desconectar la integracion de Gmail. Al desconectar Gmail se revoca el uso futuro de la integracion, aunque ciertos registros historicos pueden conservarse si son necesarios para auditoria o cumplimiento.',
		],
	},
	{
		title: '9. Derechos del usuario',
		body: [
			'El usuario puede solicitar acceso, correccion, exportacion o eliminacion de su informacion, sujeto a validacion de identidad y a obligaciones legales aplicables.',
			'Para ejercer estos derechos, puede contactarnos al correo indicado en esta pagina.',
		],
	},
	{
		title: '10. Cambios a esta politica',
		body: [
			'Podemos actualizar esta politica para reflejar cambios del servicio, requisitos legales o ajustes operativos. La version vigente estara publicada en esta ruta.',
		],
	},
];

export default function PrivacyPolicyPage() {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<PublicNavbar />

			<section className="mx-auto w-full max-w-4xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
				<div className="border-b border-border pb-8">
					<p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
						Kaiser DTE
					</p>
					<h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
						Politica de privacidad
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
							11. Contacto
						</h2>
						<p className="text-base leading-8 text-muted-foreground">
							Para consultas sobre privacidad, eliminacion de datos o la integracion
							con Gmail, escriba a{' '}
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
								href="/terminos-condiciones"
								className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
							>
								Ver terminos y condiciones
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
