import type { PreparedEmission } from '@/lib/facturacion/prepare-emission';

export type ConsumerInvoiceItemInput = {
  codigo?: string;
  descripcion?: string;
  cantidad?: number;
  uniMedida?: number;
  precioUni?: number;
  montoDescu?: number;
  ventaNoSuj?: number;
  ventaExenta?: number;
  ventaGravada?: number;
  noGravado?: number;
  tipoItem?: number;
};

function nullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeNrc(value: unknown, required = false) {
  const nrc = cleanDigits(value);
  if (!nrc) return required ? '' : null;
  if (nrc.length > 8) return required ? nrc.slice(0, 8) : null;
  return nrc;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function buildConsumerReceptorPayload(row: Record<string, unknown>) {
  return {
    tipoDocumento: nullableString(row.tipo_documento_codigo),
    numDocumento: nullableString(row.numero_documento),
    nrc: normalizeNrc(row.nrc),
    nombre: nullableString(row.nombre),
    codActividad: nullableString(row.codigo_actividad),
    descActividad: nullableString(row.actividad_nombre),
    direccion: null,
    telefono: nullableString(row.telefono),
    correo: nullableString(row.correo),
  };
}

export function validateConsumerInvoiceItems(items: ConsumerInvoiceItemInput[]) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Agrega al menos un item para facturar.');
  }

  return items.map((item, index) => {
    const descripcion = String(item.descripcion || '').trim();
    const cantidad = toNumber(item.cantidad);
    const precioUni = toNumber(item.precioUni);
    const montoDescu = toNumber(item.montoDescu);

    if (!descripcion) throw new Error(`Item ${index + 1}: descripcion requerida.`);
    if (cantidad <= 0) throw new Error(`Item ${index + 1}: cantidad debe ser mayor a cero.`);
    if (
      precioUni <= 0 &&
      toNumber(item.ventaGravada) <= 0 &&
      toNumber(item.ventaExenta) <= 0 &&
      toNumber(item.ventaNoSuj) <= 0 &&
      toNumber(item.noGravado) <= 0
    ) {
      throw new Error(`Item ${index + 1}: precio unitario o venta requerida.`);
    }

    return {
      tipoItem: Number(item.tipoItem || 2),
      codigo: nullableString(item.codigo),
      descripcion,
      cantidad,
      uniMedida: Number(item.uniMedida || 59),
      precioUni,
      montoDescu,
      ventaNoSuj: toNumber(item.ventaNoSuj),
      ventaExenta: toNumber(item.ventaExenta),
      ventaGravada: toNumber(item.ventaGravada),
      noGravado: toNumber(item.noGravado),
    };
  });
}

export function sumConsumerInvoiceItems(items: ReturnType<typeof validateConsumerInvoiceItems>) {
  return items.reduce((total, item) => {
    const explicit = item.ventaNoSuj + item.ventaExenta + item.ventaGravada + item.noGravado;
    return total + (explicit > 0 ? explicit : item.cantidad * item.precioUni - item.montoDescu);
  }, 0);
}

export function buildConsumerInvoiceDocumentRequest(
  prepared: PreparedEmission,
  receptor: Record<string, unknown>,
  items: ConsumerInvoiceItemInput[],
  observaciones?: string
) {
  const validatedItems = validateConsumerInvoiceItems(items);
  const { ambiente, sequenceFields, emisor } = prepared;

  return {
    ambiente,
    correlativo: sequenceFields.correlativo,
    numeroControl: sequenceFields.numeroControl,
    establecimientoTipo: sequenceFields.establecimientoTipo,
    establecimiento: sequenceFields.establecimiento,
    puntoVenta: sequenceFields.puntoVenta,
    emisor,
    receptor: buildConsumerReceptorPayload(receptor),
    items: validatedItems,
    pagos: [
      {
        codigo: '01',
        montoPago: Number(sumConsumerInvoiceItems(validatedItems).toFixed(2)),
      },
    ],
    observaciones: nullableString(observaciones),
  };
}
