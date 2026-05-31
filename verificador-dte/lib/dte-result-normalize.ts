type RowRecord = Record<string, unknown>;

export type MontoField = {
  label: string;
  value: unknown;
};

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '' || value.trim() === '-';
  return false;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return '';
}

export function formatMontoDisplay(value: unknown): string {
  if (isEmpty(value)) return '-';
  const n = Number(value);
  if (Number.isFinite(n)) {
    return n.toLocaleString('es-SV', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return asString(value);
}

export function getCodigoGeneracion(row: RowRecord): string {
  return firstNonEmpty(
    row.codGen,
    row.codigoGeneracion,
    row.CodigoGeneracion,
    row.Generacion
  );
}

export function getSelloRecepcion(row: RowRecord): string {
  return firstNonEmpty(
    row.selloRecepcion,
    row.selloRecibido,
    row.SelloRecibido,
    row.SelloRecepcion
  );
}

function formatObservacionesArray(observaciones: unknown): string | undefined {
  if (!Array.isArray(observaciones) || observaciones.length === 0) return undefined;

  const parts = observaciones
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        const numero = row.numero ?? row.num ?? '';
        const texto = row.observacion ?? row.descripcion ?? row.texto ?? '';
        if (numero && texto) return `${numero}: ${texto}`;
        return String(texto || numero || JSON.stringify(item));
      }
      return String(item);
    })
    .filter((part) => part.trim());

  return parts.length ? parts.join(' | ') : undefined;
}

export function getComentario(row: RowRecord): string {
  const observaciones = formatObservacionesArray(row.observaciones);
  const parts = [
    asString(row.observacionesTexto),
    observaciones,
    asString(row.descripcionEstado),
    asString(row.descripcionMsg),
    asString(row.loteError),
    asString(row.Observaciones),
    asString(row.Error),
    asString(row.error),
    asString(row.Estado),
  ].filter((part) => part && part !== '-');

  return parts.join(' | ') || '-';
}

export function getMontosFields(row: RowRecord): MontoField[] {
  const verificadorFields: MontoField[] = [
    { label: 'Monto total', value: row.montoTotal },
    { label: 'Monto total operación', value: row.montoTotalOperacion },
    { label: 'IVA operaciones', value: row.ivaOperaciones ?? row.iva },
    { label: 'IVA percibido', value: row.ivaPercibido },
    { label: 'IVA retenido', value: row.ivaRetenido },
    { label: 'Retención renta', value: row.retencionRenta ?? row.ReteRenta },
    { label: 'Total no afectos', value: row.totalNoAfectos },
    { label: 'Total a pagar', value: row.totalPagarOperacion ?? row.totalPagar ?? row.TotalPagar },
    { label: 'Otros tributos', value: row.otrosTributos },
  ];

  const extraerFields: MontoField[] = [
    { label: 'Exenta', value: row.Exenta },
    { label: 'Monto gravado', value: row.MontoGravado },
    { label: 'IVA', value: row.IVA },
    { label: 'Percepción', value: row.Percepcion },
    { label: 'Precio unitario', value: row.PrecioUni },
    { label: 'Descuento', value: row.MontoDescu },
    { label: 'Compra', value: row.Compra },
    { label: 'Subtotal', value: row.SubTotal },
    { label: 'Total a pagar', value: row.TotalPagar },
  ];

  const merged = [...verificadorFields, ...extraerFields];
  const seen = new Set<string>();

  return merged.filter(({ label, value }) => {
    if (isEmpty(value) || seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

export function formatMontosFromFields(fields: MontoField[]): string {
  return fields
    .filter(({ value }) => !isEmpty(value))
    .map(({ label, value }) => `${label}: ${formatMontoDisplay(value)}`)
    .join('; ');
}

export function toPdfExportRow(row: RowRecord) {
  const montosFields = getMontosFields(row);
  return {
    codigoGeneracion: getCodigoGeneracion(row) || '-',
    selloRecepcion: getSelloRecepcion(row) || '-',
    montos: formatMontosFromFields(montosFields) || '-',
    comentario: getComentario(row),
  };
}
