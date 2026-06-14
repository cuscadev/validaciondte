export type PlanRoute = {
  key: string;
  label: string;
};

export type PlanRouteGroup = {
  key: string;
  label: string;
  routes: PlanRoute[];
};

export const VERIFICADOR_ROUTES: PlanRoute[] = [
  { key: 'verificador', label: 'Verificador Links' },
  { key: 'verificarodyfecha', label: 'Verificar Codigo y Fecha' },
  { key: 'verificadorjson', label: 'Verificador JSON' },
  { key: 'verificacion_individual', label: 'Verificacion Individual' },
  { key: 'verificador_qr', label: 'Escaneo QR DTE' },
];

export const CONSULTAS_LOTES_ROUTES: PlanRoute[] = [
  { key: 'consulta_lote_codigo', label: 'Consulta por codigo de lote' },
  { key: 'consultas_lotes_excel_codigo_fecha', label: 'Excel codigo y fecha' },
  { key: 'consultas_lotes_json', label: 'Subir JSON' },
  { key: 'consultas_lotes_individual', label: 'Consulta individual' },
  { key: 'consultas_lotes_qr_pdf', label: 'QR PDF' },
];

export const EXTRAER_ROUTES: PlanRoute[] = [
  { key: 'compras-json', label: 'Compras JSON' },
  { key: 'ventas-json', label: 'Ventas JSON' },
  { key: 'sujetos-excluidos', label: 'Sujetos Excluidos JSON' },
  { key: 'liquidacion-json', label: 'Liquidaciones JSON' },
  { key: 'qr-pdf', label: 'QR PDF' },
];

export const STANDALONE_PLAN_ROUTES: PlanRoute[] = [
  { key: 'plantillas-pdf', label: 'Plantillas PDF' },
  { key: 'escaneos-mobile', label: 'Escaneo desde la app' },
  { key: 'hacienda-credentials', label: 'Card Ministerio de Hacienda' },
  { key: 'integraciones-imap', label: 'Importar desde correo' },
];

export const FACTURACION_ROUTES: PlanRoute[] = [
  { key: 'facturacion-consumidor-final', label: 'Facturar consumidor final' },
  { key: 'facturacion-credito-fiscal', label: 'Emitir credito fiscal' },
  { key: 'facturacion-exportacion', label: 'Factura de exportacion' },
  { key: 'facturacion-nota-credito', label: 'Nota de credito' },
  { key: 'facturacion-nota-debito', label: 'Nota de debito' },
  { key: 'facturacion-sujeto-excluido', label: 'Facturar sujeto excluido' },
  { key: 'facturacion-envio-lotes', label: 'Envio de lotes' },
  { key: 'facturacion-reporte', label: 'Reporte de facturacion' },
  { key: 'facturacion-prueba-emision', label: 'Prueba de emision' },
  { key: 'facturacion-receptores', label: 'Receptores' },
];

export const DEFAULT_FREE_ROUTES = [
  'compras-json',
  'ventas-json',
  'sujetos-excluidos',
  'liquidacion-json',
];

export const DEFAULT_PREMIUM_ROUTES = [
  ...VERIFICADOR_ROUTES.map((route) => route.key),
  ...CONSULTAS_LOTES_ROUTES.map((route) => route.key),
  ...EXTRAER_ROUTES.map((route) => route.key),
  ...FACTURACION_ROUTES.map((route) => route.key),
  ...STANDALONE_PLAN_ROUTES.map((route) => route.key),
];

export const DEFAULT_PRO_ROUTES = DEFAULT_PREMIUM_ROUTES;

export const PLAN_ROUTE_GROUPS: PlanRouteGroup[] = [
  { key: 'verificador', label: 'Verificar DTEs', routes: VERIFICADOR_ROUTES },
  { key: 'consultas-lotes', label: 'Consultas lotes', routes: CONSULTAS_LOTES_ROUTES },
  { key: 'extraer', label: 'Extraer DTEs', routes: EXTRAER_ROUTES },
  { key: 'facturacion', label: 'Facturacion', routes: FACTURACION_ROUTES },
  { key: 'otros', label: 'Otros modulos', routes: STANDALONE_PLAN_ROUTES },
];

export const ALL_PLAN_ROUTE_KEYS = PLAN_ROUTE_GROUPS.flatMap((group) =>
  group.routes.map((route) => route.key),
);

export const FALLBACK_PLAN_ROUTES: Record<string, string[]> = {
  free: DEFAULT_FREE_ROUTES,
  premium: DEFAULT_PREMIUM_ROUTES,
  pro: DEFAULT_PRO_ROUTES,
};

export function getFallbackRoutesForPlan(planType: string): string[] {
  return FALLBACK_PLAN_ROUTES[planType] ?? DEFAULT_FREE_ROUTES;
}

export function getRouteLabel(routeKey: string): string {
  for (const group of PLAN_ROUTE_GROUPS) {
    const route = group.routes.find((item) => item.key === routeKey);
    if (route) return route.label;
  }
  return routeKey;
}

export const FACTURACION_ROUTE_BY_PATH: Record<string, string> = {
  '/facturacion/consumidor-final': 'facturacion-consumidor-final',
  '/facturacion/credito-fiscal': 'facturacion-credito-fiscal',
  '/facturacion/exportacion': 'facturacion-exportacion',
  '/facturacion/nota-credito': 'facturacion-nota-credito',
  '/facturacion/nota-debito': 'facturacion-nota-debito',
  '/facturacion/sujeto-excluido': 'facturacion-sujeto-excluido',
  '/facturacion/envio-lotes': 'facturacion-envio-lotes',
  '/facturacion/reporte': 'facturacion-reporte',
  '/facturacion/prueba-emision': 'facturacion-prueba-emision',
  '/facturacion/receptores': 'facturacion-receptores',
};
