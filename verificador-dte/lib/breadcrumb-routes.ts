export type BreadcrumbSegment = {
  label: string;
  href?: string;
};

type RouteEntry = {
  segments: BreadcrumbSegment[];
};

const ROUTE_MAP: Record<string, RouteEntry> = {
  '/dashboard': {
    segments: [{ label: 'Inicio' }],
  },
  '/consultarjson': {
    segments: [{ label: 'Consultar JSON' }],
  },
  '/verificadorDTE/verificador': {
    segments: [
      { label: 'Verificador DTE', href: '/verificadorDTE/verificador' },
      { label: 'Enlaces' },
    ],
  },
  '/verificadorDTE/verificarodyfecha': {
    segments: [
      { label: 'Verificador DTE', href: '/verificadorDTE/verificador' },
      { label: 'Codigo y fecha' },
    ],
  },
  '/verificadorDTE/verificadorjson': {
    segments: [
      { label: 'Verificador DTE', href: '/verificadorDTE/verificador' },
      { label: 'JSON' },
    ],
  },
  '/verificadorDTE/verificacion_individual': {
    segments: [
      { label: 'Verificador DTE', href: '/verificadorDTE/verificador' },
      { label: 'Consulta individual' },
    ],
  },
  '/verificadorDTE/consulta-lote': {
    segments: [
      { label: 'Verificador DTE', href: '/verificadorDTE/verificador' },
      { label: 'Consulta lote' },
    ],
  },
  '/consultas-lotes/codigo-lote': {
    segments: [
      { label: 'Consultas lotes', href: '/consultas-lotes/codigo-lote' },
      { label: 'Codigo de lote' },
    ],
  },
  '/consultas-lotes/excel-codigo-fecha': {
    segments: [
      { label: 'Consultas lotes', href: '/consultas-lotes/codigo-lote' },
      { label: 'Excel codigo y fecha' },
    ],
  },
  '/consultas-lotes/json': {
    segments: [
      { label: 'Consultas lotes', href: '/consultas-lotes/codigo-lote' },
      { label: 'Subir JSON' },
    ],
  },
  '/consultas-lotes/individual': {
    segments: [
      { label: 'Consultas lotes', href: '/consultas-lotes/codigo-lote' },
      { label: 'Consulta individual' },
    ],
  },
  '/consultas-lotes/qr-pdf': {
    segments: [
      { label: 'Consultas lotes', href: '/consultas-lotes/codigo-lote' },
      { label: 'QR PDF' },
    ],
  },
  '/extraer/compras-json': {
    segments: [
      { label: 'Extraer', href: '/extraer/compras-json' },
      { label: 'Compras JSON' },
    ],
  },
  '/extraer/ventas-json': {
    segments: [
      { label: 'Extraer', href: '/extraer/compras-json' },
      { label: 'Ventas JSON' },
    ],
  },
  '/extraer/sujetos-excluidos': {
    segments: [
      { label: 'Extraer', href: '/extraer/compras-json' },
      { label: 'Sujetos excluidos' },
    ],
  },
  '/extraer/liquidacion-json': {
    segments: [
      { label: 'Extraer', href: '/extraer/compras-json' },
      { label: 'Liquidaciones JSON' },
    ],
  },
  '/extraer/qr-pdf': {
    segments: [
      { label: 'Extraer', href: '/extraer/compras-json' },
      { label: 'QR PDF' },
    ],
  },
  '/plantillas-pdf': {
    segments: [{ label: 'Plantillas PDF' }],
  },
  '/plantillas-pdf/generar': {
    segments: [
      { label: 'Plantillas PDF', href: '/plantillas-pdf' },
      { label: 'Generar' },
    ],
  },
  '/escaneos-mobile': {
    segments: [{ label: 'Escaneo desde la app' }],
  },
  '/tributario': {
    segments: [{ label: 'Tributario' }],
  },
  '/configuraciones': {
    segments: [{ label: 'Configuracion' }],
  },
  '/integraciones/gmail': {
    segments: [
      { label: 'Integraciones', href: '/integraciones/gmail' },
      { label: 'Gmail DTE' },
    ],
  },
  '/profile': {
    segments: [{ label: 'Perfil' }],
  },
  '/usuarios': {
    segments: [{ label: 'Usuarios org.' }],
  },
  '/organizacion/kyc': {
    segments: [{ label: 'Datos fiscales (KYC)' }],
  },
  '/reportes': {
    segments: [{ label: 'Reportes' }],
  },
  '/prrocesardte': {
    segments: [{ label: 'Procesar DTE' }],
  },
  '/admin/users': {
    segments: [
      { label: 'Admin', href: '/admin/users' },
      { label: 'Usuarios' },
    ],
  },
  '/admin/planes': {
    segments: [
      { label: 'Admin', href: '/admin/users' },
      { label: 'Planes' },
    ],
  },
  '/admin/organizaciones': {
    segments: [
      { label: 'Admin', href: '/admin/users' },
      { label: 'Usuarios' },
    ],
  },
  '/admin/avisos': {
    segments: [
      { label: 'Admin', href: '/admin/users' },
      { label: 'Avisos' },
    ],
  },
  '/admin/obligacion': {
    segments: [
      { label: 'Admin', href: '/admin/users' },
      { label: 'Obligaciones' },
    ],
  },
  '/admin/monitoreo/visitantes': {
    segments: [
      { label: 'Admin', href: '/admin/users' },
      { label: 'Monitoreo', href: '/admin/monitoreo/visitantes' },
      { label: 'Visitantes landing' },
    ],
  },
  '/admin/monitoreo/procesamiento': {
    segments: [
      { label: 'Admin', href: '/admin/users' },
      { label: 'Monitoreo', href: '/admin/monitoreo/visitantes' },
      { label: 'Procesamiento' },
    ],
  },
  '/admin/monitoreo/inicios-sesion': {
    segments: [
      { label: 'Admin', href: '/admin/users' },
      { label: 'Monitoreo', href: '/admin/monitoreo/visitantes' },
      { label: 'Inicios de sesion' },
    ],
  },
  '/admin/monitoreo/licencias': {
    segments: [
      { label: 'Admin', href: '/admin/users' },
      { label: 'Monitoreo', href: '/admin/monitoreo/visitantes' },
      { label: 'Licencias' },
    ],
  },
};

function humanizeSlug(slug: string) {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function fallbackSegments(pathname: string): BreadcrumbSegment[] {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) {
    return [{ label: 'Inicio', href: '/dashboard' }];
  }

  const segments: BreadcrumbSegment[] = [{ label: 'Inicio', href: '/dashboard' }];
  let current = '';

  parts.forEach((part, index) => {
    current += `/${part}`;
    const isLast = index === parts.length - 1;
    segments.push({
      label: humanizeSlug(part),
      href: isLast ? undefined : current,
    });
  });

  return segments;
}

export function getBreadcrumbSegments(pathname: string): BreadcrumbSegment[] {
  const normalized = pathname.split('?')[0].replace(/\/$/, '') || '/';
  const entry = ROUTE_MAP[normalized];

  if (entry) {
    return [{ label: 'Inicio', href: '/dashboard' }, ...entry.segments];
  }

  return fallbackSegments(normalized);
}
