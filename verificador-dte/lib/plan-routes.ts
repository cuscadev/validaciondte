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
  { key: 'integraciones-gmail', label: 'Importar desde Gmail' },
];

export const PLAN_ROUTE_GROUPS: PlanRouteGroup[] = [
  { key: 'verificador', label: 'Verificar DTEs', routes: VERIFICADOR_ROUTES },
  { key: 'consultas-lotes', label: 'Consultas lotes', routes: CONSULTAS_LOTES_ROUTES },
  { key: 'extraer', label: 'Extraer DTEs', routes: EXTRAER_ROUTES },
  { key: 'otros', label: 'Otros modulos', routes: STANDALONE_PLAN_ROUTES },
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
  ...STANDALONE_PLAN_ROUTES.map((route) => route.key),
];

export const DEFAULT_PRO_ROUTES = DEFAULT_PREMIUM_ROUTES;
