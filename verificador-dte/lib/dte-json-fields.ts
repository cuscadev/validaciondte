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

export type PartyFields = {
  nit: string;
  nrc: string;
  nombre: string;
  codActividad: string;
  descActividad: string;
  nombreComercial: string;
  telefono: string;
  correo: string;
  departamento: string;
  municipio: string;
  complemento: string;
};

function extractParty(party: JsonRecord): PartyFields {
  const direccion = asRecord(party.direccion);
  return {
    nit: asString(party.nit),
    nrc: asString(party.nrc),
    nombre: asString(party.nombre).toUpperCase(),
    codActividad: asString(party.codActividad),
    descActividad: asString(party.descActividad),
    nombreComercial: asString(party.nombreComercial),
    telefono: asString(party.telefono),
    correo: asString(party.correo),
    departamento: asString(direccion.departamento),
    municipio: asString(direccion.municipio),
    complemento: asString(direccion.complemento),
  };
}

export function extractReceptor(obj: JsonRecord) {
  const receptor = extractParty(asRecord(obj.receptor));
  return {
    nit: receptor.nit,
    nrc: receptor.nrc,
    nombre: receptor.nombre,
  };
}

export function extractReceptorFull(obj: JsonRecord): PartyFields {
  return extractParty(asRecord(obj.receptor));
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
  const emisor = extractParty(asRecord(obj.emisor));
  return {
    nit: emisor.nit,
    nrc: emisor.nrc,
    nombre: emisor.nombre,
  };
}

export function extractEmisorFull(obj: JsonRecord): PartyFields {
  return extractParty(asRecord(obj.emisor));
}

export function extractLibroParties(obj: JsonRecord) {
  const emisor = extractEmisorFull(obj);
  const receptor = extractReceptorFull(obj);
  return {
    EmisorNIT: emisor.nit,
    EmisorNRC: emisor.nrc,
    EmisorNombre: emisor.nombre,
    ReceptorNIT: receptor.nit,
    ReceptorNRC: receptor.nrc,
    ReceptorNombre: receptor.nombre,
  };
}
