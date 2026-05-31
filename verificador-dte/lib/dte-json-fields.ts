type JsonRecord = Record<string, unknown>;

type TributoDte = {
  codigo?: string;
  valor?: number;
};

export type ResumenMontos = {
  exenta: number;
  gravada: number;
  iva: number;
  percepcion: number;
  totalPagar: number;
  montoTotalOperacion: number;
};

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
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

export function extractReceptor(obj: JsonRecord) {
  const receptor = asRecord(obj.receptor);
  return {
    nit: asString(receptor.nit),
    nrc: asString(receptor.nrc),
    nombre: asString(receptor.nombre).toUpperCase(),
  };
}

export function extractSelloFromJson(obj: JsonRecord): string {
  return firstNonEmpty(
    obj.selloRecibido,
    obj.selloRecepcion,
    obj.SelloRecibido,
    obj.SelloRecepcion,
    asRecord(obj.respuestaHacienda).selloRecibido,
    asRecord(obj.respuestaHacienda).selloRecepcion,
    asRecord(obj.respuestaHacienda).SelloRecibido,
    asRecord(obj.respuestaHacienda).SelloRecepcion,
    asRecord(obj.responseHacienda).selloRecibido,
    asRecord(obj.responseHacienda).selloRecepcion,
    asRecord(obj.responseHacienda).SelloRecibido,
    asRecord(obj.responseHacienda).SelloRecepcion,
    asRecord(obj.responseMH).selloRecibido,
    asRecord(obj.responseMH).selloRecepcion
  );
}

export function extractResumenMontos(obj: JsonRecord): ResumenMontos {
  const resumen = asRecord(obj.resumen);
  const exenta = toNumber(resumen.totalExenta);
  const gravada = toNumber(resumen.totalGravada);

  const ivaTributo = Array.isArray(resumen.tributos)
    ? toNumber(
        (resumen.tributos as TributoDte[]).find(
          (t) => String(t?.codigo) === '20'
        )?.valor
      )
    : 0;

  const ivaDesdeResumen =
    toNumber(resumen.totalIva) ||
    toNumber(resumen.ivaPerci1) ||
    ivaTributo;

  const iva =
    ivaDesdeResumen > 0
      ? ivaDesdeResumen
      : Number((gravada * 0.13).toFixed(2));

  const percepcion =
    gravada > 100 ? Number((gravada * 0.01).toFixed(2)) : 0;

  return {
    exenta,
    gravada,
    iva,
    percepcion,
    totalPagar: toNumber(resumen.totalPagar),
    montoTotalOperacion: toNumber(
      resumen.montoTotalOperacion ?? resumen.subTotalVentas ?? gravada + exenta
    ),
  };
}

export function extractIdentificacion(obj: JsonRecord) {
  const identificacion = asRecord(obj.identificacion);
  return {
    generacion: asString(identificacion.codigoGeneracion),
    numeroControl: asString(identificacion.numeroControl),
    fechaISO: asString(identificacion.fecEmi),
    tipoDte: asString(identificacion.tipoDte),
  };
}

export function extractEmisor(obj: JsonRecord) {
  const emisor = asRecord(obj.emisor);
  return {
    nit: asString(emisor.nit),
    nrc: asString(emisor.nrc),
    nombre: asString(emisor.nombre).toUpperCase(),
  };
}
