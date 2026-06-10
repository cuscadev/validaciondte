export type DteJsonResultado = {
  ambiente?: string;
  codGen?: string;
  codigoGeneracion?: string;
  fechaEmi?: string;
  url?: string;
  linkVisita?: string;
  estado?: 'EMITIDO' | 'ANULADO' | 'RECHAZADO' | 'NO ENCONTRADO' | 'ERROR' | string;
  descripcionEstado?: string;
  error?: string;
  nombreArchivo?: string;
  tipoDte?: string;
  numeroControl?: string;
  selloRecepcion?: string;
  emisorNit?: string;
  emisorNrc?: string;
  emisorNombre?: string;
  receptorNit?: string;
  receptorNrc?: string;
  receptorNombre?: string;
  montoTotal?: string;
  totalPagarOperacion?: string;
  ivaOperaciones?: string;
  ajustado?: boolean;
  documentoAjustado?: string;
  tieneNotaCredito?: boolean;
  notaCreditoCodigoGeneracion?: string;
  notaCreditoFechaGeneracion?: string;
  notaCreditoFechaEmi?: string;
  notaCreditoSelloRecepcion?: string;
  notaCreditoEstado?: string;
  notaCreditoLinkVisita?: string;
  observacionesTexto?: string;
  relacionadosTexto?: string;
};

export function estadoClassDteJson(estado?: string) {
  switch (estado) {
    case 'EMITIDO':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200';
    case 'ANULADO':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
    case 'RECHAZADO':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
    case 'NO ENCONTRADO':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    case 'ERROR':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
}
