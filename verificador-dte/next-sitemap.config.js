const siteUrl =
	process.env.NEXT_PUBLIC_APP_URL &&
	!process.env.NEXT_PUBLIC_APP_URL.includes('localhost')
		? process.env.NEXT_PUBLIC_APP_URL
		: 'https://verificadordte.cuscadev.com';

const indexablePaths = new Set([
	'/',
	'/facturacion-electronica',
	'/auditoria-dte',
	'/precios',
	'/verificacion-dte',
	'/consulta-hacienda',
]);

const privatePaths = [
	'/admin',
	'/admin/*',
	'/api/*',
	'/bancos',
	'/bancos/*',
	'/configuraciones',
	'/consultarjson',
	'/consultas-lotes',
	'/consultas-lotes/*',
	'/dashboard',
	'/escaneo-qr',
	'/escaneos-mobile',
	'/extraer',
	'/extraer/*',
	'/integraciones',
	'/integraciones/*',
	'/invitacion-colaborador',
	'/landing',
	'/login',
	'/mfa-login',
	'/mfa-setup',
	'/onboarding',
	'/organizacion',
	'/organizacion/*',
	'/plantillas-pdf',
	'/plantillas-pdf/*',
	'/profile',
	'/protected',
	'/prrocesardte',
	'/register',
	'/reportes',
	'/reset-password',
	'/signup',
	'/totp-verify',
	'/tributario',
	'/usuarios',
	'/verificadorDTE',
	'/verificadorDTE/*',
];

const robotsDisallowPaths = [
	...new Set(privatePaths.map((path) => path.replace(/\/\*$/, ''))),
];

/** @type {import('next-sitemap').IConfig} */
module.exports = {
	siteUrl,
	generateRobotsTxt: true,
	exclude: privatePaths,
	robotsTxtOptions: {
		policies: [
			{
				userAgent: '*',
				allow: '/',
				disallow: robotsDisallowPaths,
			},
		],
	},
	transform: async (config, path) => {
		if (!indexablePaths.has(path)) {
			return null;
		}

		return {
			loc: path,
			changefreq: path === '/' ? 'weekly' : 'monthly',
			priority: path === '/' ? 1 : path === '/precios' ? 0.9 : 0.8,
			lastmod: new Date().toISOString(),
		};
	},
};
