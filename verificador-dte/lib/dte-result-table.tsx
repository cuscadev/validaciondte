import type { ReactNode } from 'react';

export type DteResultRow = {
  nombreArchivo?: string;
  url?: string;
  host?: string;
  ambiente?: string;
  codGen?: string;
  fechaEmi?: string;
  estado?: string;
  estadoRaw?: string;
  descripcionEstado?: string;
  tipoDte?: string;
  tipoDteNorm?: string;
  fechaHoraGeneracion?: string;
  fechaHoraTransmision?: string;
  fechaHoraProcesamiento?: string;
  codigoGeneracion?: string;
  selloRecepcion?: string;
  numeroControl?: string;
  montoTotal?: string;
  montoTotalOperacion?: string;
  ivaOperaciones?: string;
  ivaPercibido?: string;
  ivaRetenido?: string;
  retencionRenta?: string;
  totalNoAfectos?: string;
  totalPagarOperacion?: string;
  otrosTributos?: string;
  documentoAjustado?: string;
  documentoEventoAplicado?: string;
  ajustado?: boolean;
  observacionesTexto?: string;
  relacionadosTexto?: string;
  tieneNotaCredito?: boolean;
  notaCreditoCodigoGeneracion?: string;
  notaCreditoFechaGeneracion?: string;
  notaCreditoFechaEmi?: string;
  notaCreditoSelloRecepcion?: string;
  notaCreditoEstado?: string;
  notaCreditoLinkVisita?: string;
  error?: string;
  linkVisita?: string;
  visitar?: string;
};

export const DTE_RESULT_COLUMNS = [
  { key: 'nombreArchivo', label: 'Archivo' },
  { key: 'codGen', label: 'Código Generación' },
  { key: 'estado', label: 'Estado' },
  { key: 'descripcionEstado', label: 'Descripción Estado' },
  { key: 'tipoDte', label: 'Tipo DTE' },
  { key: 'fechaHoraGeneracion', label: 'Fecha Generación' },
  { key: 'fechaHoraTransmision', label: 'Fecha Transmisión' },
  { key: 'numeroControl', label: 'N° Control' },
  { key: 'montoTotal', label: 'Monto Total' },
  { key: 'montoTotalOperacion', label: 'Monto Total Operación' },
  { key: 'ivaOperaciones', label: 'IVA Operaciones' },
  { key: 'ivaPercibido', label: 'IVA Percibido' },
  { key: 'ivaRetenido', label: 'IVA Retenido' },
  { key: 'retencionRenta', label: 'Retención Renta' },
  { key: 'totalNoAfectos', label: 'Total No Afectos' },
  { key: 'totalPagarOperacion', label: 'Total Operación' },
  { key: 'ajustado', label: 'Ajustado' },
  { key: 'documentoAjustado', label: 'Doc. Ajustado' },
  { key: 'documentoEventoAplicado', label: 'Evento Aplicado' },
  { key: 'tieneNotaCredito', label: 'Tiene NC' },
  { key: 'notaCreditoCodigoGeneracion', label: 'Código NC' },
  { key: 'notaCreditoFechaGeneracion', label: 'Fecha NC' },
  { key: 'notaCreditoFechaEmi', label: 'Fecha Emi NC' },
  { key: 'notaCreditoSelloRecepcion', label: 'Sello NC' },
  { key: 'notaCreditoEstado', label: 'Estado NC' },
  { key: 'notaCreditoLinkVisita', label: 'Abrir NC' },
  { key: 'relacionadosTexto', label: 'Docs. Relacionados' },
  { key: 'observacionesTexto', label: 'Observaciones' },
  { key: 'error', label: 'Error' },
  { key: 'visitar', label: 'Visitar' },
] as const;

export type DteResultColumnKey = (typeof DTE_RESULT_COLUMNS)[number]['key'];

export function estadoPill(v?: string) {
  if (!v) return '';
  switch (v) {
    case 'EMITIDO':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200';
    case 'ANULADO':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
    case 'RECHAZADO':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
    case 'INVALIDADO':
      return 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
}

export function dteResultSearchFields(r: DteResultRow): string[] {
  return [
    r.nombreArchivo,
    r.codGen,
    r.estado,
    r.descripcionEstado,
    r.tipoDte,
    r.numeroControl,
    r.montoTotal,
    r.montoTotalOperacion,
    r.fechaHoraGeneracion,
    r.fechaHoraTransmision,
    r.ivaOperaciones,
    r.ivaPercibido,
    r.ivaRetenido,
    r.retencionRenta,
    r.totalNoAfectos,
    r.totalPagarOperacion,
    r.observacionesTexto,
    r.documentoAjustado,
    r.documentoEventoAplicado,
    r.relacionadosTexto,
    r.notaCreditoEstado,
    r.notaCreditoCodigoGeneracion,
    r.notaCreditoFechaGeneracion,
    r.notaCreditoFechaEmi,
    r.notaCreditoSelloRecepcion,
    r.linkVisita,
    r.url,
  ].map((v) => v || '');
}

export function renderDteResultCell(
  colKey: DteResultColumnKey,
  row: DteResultRow
): ReactNode {
  const v = (row as Record<string, unknown>)[colKey] ?? '';
  const isEstado = colKey === 'estado' || colKey === 'notaCreditoEstado';
  const isVisitar = colKey === 'visitar';
  const isNotaCreditoLink = colKey === 'notaCreditoLinkVisita';
  const isBool = colKey === 'ajustado' || colKey === 'tieneNotaCredito';

  if (isEstado) {
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs ${estadoPill(String(v))}`}>
        {String(v || '')}
      </span>
    );
  }
  if (isVisitar) {
    return row.linkVisita || row.url ? (
      <a
        href={row.linkVisita || row.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
        title="Abrir en nueva pestaña"
      >
        {row.visitar || 'Abrir'}
      </a>
    ) : (
      ''
    );
  }
  if (isNotaCreditoLink) {
    return row.notaCreditoLinkVisita ? (
      <a
        href={row.notaCreditoLinkVisita}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
        title="Abrir nota de crédito en Hacienda"
      >
        Abrir NC
      </a>
    ) : (
      ''
    );
  }
  if (isBool) {
    return v === true || v === 'true'
      ? 'Sí'
      : v === false || v === 'false'
        ? 'No'
        : String(v || '');
  }
  return String(v || '');
}

export function isDteResultLongTextColumn(colKey: DteResultColumnKey) {
  return (
    colKey === 'relacionadosTexto' ||
    colKey === 'descripcionEstado' ||
    colKey === 'observacionesTexto' ||
    colKey === 'documentoAjustado' ||
    colKey === 'documentoEventoAplicado'
  );
}
