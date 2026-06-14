export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createEmision, mergeEmision } from '@/lib/facturacion/emisiones-store';
import { prepareEmission, postGo } from '@/lib/facturacion/prepare-emission';
import { isValidDteMunicipioCode } from '@/lib/facturacion/resolve-location';
import { GoFacturacionError } from '@/lib/facturacion/go-facturacion-client';
import { getHaciendaTokenForUser } from '@/lib/hacienda-auth';
import { resolveCertificatePassword } from '@/lib/facturacion/certificate-credentials';
import { requireAuth } from '@/lib/server-auth';

type JsonRecord = Record<string, unknown>;

type InvoiceItem = {
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

type ProcessTiming = {
  startedAt: string;
  documentCreatedAt?: string;
  signedAt?: string;
  sentToHaciendaAt?: string;
  receivedFromHaciendaAt?: string;
  documentCreationMs?: number;
  signingMs?: number;
  haciendaMs?: number;
  totalMs?: number;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeHaciendaToken(value: unknown) {
  return getString(value).replace(/^Bearer\s+/i, '').trim();
}

function extractSello(response: unknown): string {
  const body = asRecord(response);
  return (
    getString(body.selloRecibido) ||
    getString(body.selloRecepcion) ||
    getString(asRecord(body.body).selloRecibido) ||
    getString(asRecord(body.body).selloRecepcion)
  );
}

function buildExportReceptor(input: JsonRecord) {
  const nombre = getString(input.nombre).trim();
  const codPais = getString(input.codPais).trim().toUpperCase();
  const nombrePais = getString(input.nombrePais).trim();
  const complemento = getString(input.complemento).trim();
  const receptor = {
    tipoDocumento: nullableString(input.tipoDocumento),
    numDocumento: nullableString(input.numDocumento),
    tipoPersona: Number(input.tipoPersona || 2),
    nombre,
    nombreComercial: nullableString(input.nombreComercial),
    codPais,
    nombrePais,
    complemento,
    descActividad: nullableString(input.descActividad),
    telefono: nullableString(input.telefono),
    correo: nullableString(input.correo),
  };

  const missing: string[] = [];
  if (!receptor.nombre) missing.push('nombre');
  if (!receptor.codPais) missing.push('pais');
  if (!receptor.nombrePais) missing.push('nombre del pais');
  if (!receptor.complemento) missing.push('direccion internacional');
  if (missing.length) {
    throw new Error(`Completa el receptor de exportacion: ${missing.join(', ')}.`);
  }

  return receptor;
}

function validateItems(items: InvoiceItem[]) {
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
    if (precioUni <= 0) throw new Error(`Item ${index + 1}: precio unitario requerido.`);
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

function sumItems(items: ReturnType<typeof validateItems>, flete = 0, seguro = 0) {
  const subTotal = items.reduce((total, item) => {
    const explicit = item.ventaNoSuj + item.ventaExenta + item.ventaGravada + item.noGravado;
    return total + (explicit > 0 ? explicit : item.cantidad * item.precioUni - item.montoDescu);
  }, 0);
  return subTotal + flete + seguro;
}

export async function POST(req: NextRequest) {
  let emisionId: string | null = null;
  const requestStartedAtMs = Date.now();
  const processTiming: ProcessTiming = { startedAt: new Date(requestStartedAtMs).toISOString() };

  try {
    const user = await requireAuth(req);
    if (user.role !== 'cliente' && user.role !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      receptor?: JsonRecord;
      items?: InvoiceItem[];
      passwordPri?: string;
      transmitir?: boolean;
      environment?: 'test' | 'production';
      observaciones?: string;
      haciendaToken?: string;
      codIncoterms?: string;
      descIncoterms?: string;
      flete?: number;
      seguro?: number;
    };

    const prepared = await prepareEmission(user.uid, user.email, '11', body.environment);
    const { emisor, emisorId, environment, ambiente, sequenceFields } = prepared;
    const items = validateItems(body.items || []);
    const receptorExportacion = buildExportReceptor(asRecord(body.receptor));
    if (!emisor.codActividad || !emisor.descActividad) {
      return NextResponse.json(
        { error: 'Configura el codigo y descripcion de actividad economica del emisor antes de emitir.' },
        { status: 400 }
      );
    }
    if (!emisor.direccion.departamento || !emisor.direccion.municipio || !emisor.direccion.distrito || !emisor.direccion.complemento) {
      return NextResponse.json(
        { error: 'Configura departamento, municipio, distrito y direccion del emisor antes de emitir.' },
        { status: 400 }
      );
    }
    if (!isValidDteMunicipioCode(emisor.direccion.municipio)) {
      return NextResponse.json(
        { error: `Municipio del emisor invalido para DTE (CAT-013): ${emisor.direccion.municipio}. Debe ser codigo de 2 digitos.` },
        { status: 400 }
      );
    }
    const flete = toNumber(body.flete);
    const seguro = toNumber(body.seguro);
    const documentRequest = {
      ambiente,
      correlativo: sequenceFields.correlativo,
      numeroControl: sequenceFields.numeroControl,
      establecimientoTipo: sequenceFields.establecimientoTipo,
      establecimiento: sequenceFields.establecimiento,
      puntoVenta: sequenceFields.puntoVenta,
      emisor,
      receptor: receptorExportacion,
      otrosDocumentos: [],
      ventaTercero: null,
      items,
      pagos: [{ codigo: '01', montoPago: Number(sumItems(items, flete, seguro).toFixed(2)) }],
      codIncoterms: nullableString(body.codIncoterms),
      descIncoterms: nullableString(body.descIncoterms),
      flete,
      seguro,
      observaciones: nullableString(body.observaciones),
    };

    emisionId = await createEmision('11', {
      uid: user.uid,
      environment,
      tipoDte: '11',
      nit: emisor.nit,
      status: 'started',
      source: 'export-invoice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { emisorId });

    const documentStartMs = Date.now();
    const documentResponse = asRecord(await postGo('/api/facturacion/documents/factura-exportacion', documentRequest));
    const documentEndMs = Date.now();
    processTiming.documentCreatedAt = new Date(documentEndMs).toISOString();
    processTiming.documentCreationMs = documentEndMs - documentStartMs;

    const dteJson = documentResponse.dteJson;
    const codigoGeneracion = getString(documentResponse.codigoGeneracion);
    const numeroControl = getString(documentResponse.numeroControl);
    const totalPagar = Number(documentResponse.totalPagar || 0);

    await mergeEmision(emisionId, {
      status: 'document_created',
      documentRequest,
      documentResponse,
      codigoGeneracion,
      numeroControl,
      totalPagar,
      processTiming,
      updatedAt: new Date().toISOString(),
    });

    let firma = '';
    let signResponse: unknown = null;
    let haciendaResponse: unknown = null;
    let selloRecepcion = '';
    const passwordPri = await resolveCertificatePassword(user.uid, body.passwordPri);

    if (passwordPri) {
      const signStartMs = Date.now();
      signResponse = await postGo('/api/facturacion/sign', { nit: emisor.nit, passwordPri, dteJson });
      const signEndMs = Date.now();
      processTiming.signedAt = new Date(signEndMs).toISOString();
      processTiming.signingMs = signEndMs - signStartMs;
      firma = getString(asRecord(signResponse).firma);
      await mergeEmision(emisionId, {
        status: 'signed',
        processTiming,
        signResponse: { success: asRecord(signResponse).success, firma },
        updatedAt: new Date().toISOString(),
      });
    }

    if (body.transmitir !== false) {
      if (!firma) {
        return NextResponse.json({ error: 'Clave privada requerida para firmar antes de transmitir.' }, { status: 400 });
      }
      let token = normalizeHaciendaToken(body.haciendaToken) || await getHaciendaTokenForUser(user.uid, false, environment);
      const haciendaStartMs = Date.now();
      processTiming.sentToHaciendaAt = new Date(haciendaStartMs).toISOString();
      const transmissionRequest = {
        environment,
        ambiente,
        idEnvio: Date.now(),
        version: Number(documentResponse.version || asRecord(asRecord(dteJson).identificacion).version || 1),
        tipoDte: '11',
        documento: firma,
      };
      try {
        try {
          haciendaResponse = await postGo('/api/facturacion/transmissions/dte', transmissionRequest, {
            headers: { Authorization: token },
          });
        } catch (error) {
          if (!(error instanceof GoFacturacionError) || error.status !== 401) throw error;
          token = await getHaciendaTokenForUser(user.uid, true, environment);
          haciendaResponse = await postGo('/api/facturacion/transmissions/dte', transmissionRequest, {
            headers: { Authorization: token },
          });
        }
      } finally {
        const haciendaEndMs = Date.now();
        processTiming.receivedFromHaciendaAt = new Date(haciendaEndMs).toISOString();
        processTiming.haciendaMs = haciendaEndMs - haciendaStartMs;
      }
      selloRecepcion = extractSello(haciendaResponse);
    }

    processTiming.totalMs = Date.now() - requestStartedAtMs;
    const finalPackage = {
      tipoDte: '11',
      codigoGeneracion,
      numeroControl,
      totalPagar,
      dteJson,
      firma,
      selloRecepcion,
      haciendaResponse,
      processTiming,
      downloads: {
        json: `/api/facturacion/emissions/${emisionId}/json`,
        pdf: `/api/facturacion/emissions/${emisionId}/pdf`,
      },
    };

    const status = selloRecepcion ? 'received' : firma ? 'signed' : 'document_created';
    await mergeEmision(emisionId, {
      status,
      selloRecepcion,
      haciendaResponse,
      processTiming,
      finalPackage,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      id: emisionId,
      status,
      codigoGeneracion,
      numeroControl,
      totalPagar,
      selloRecepcion,
      processTiming,
      finalPackage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo emitir factura de exportacion';
    processTiming.totalMs = Date.now() - requestStartedAtMs;
    if (emisionId) {
      await mergeEmision(emisionId, {
        status: 'error',
        error: message,
        processTiming,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }
    return NextResponse.json({ error: message, processTiming }, { status: 500 });
  }
}
