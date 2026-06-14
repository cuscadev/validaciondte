export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createEmision, mergeEmision } from '@/lib/facturacion/emisiones-store';
import {
  resolveReceptorDteLocation,
} from '@/lib/facturacion/build-emisor';
import { isValidDteMunicipioCode } from '@/lib/facturacion/resolve-location';
import { prepareEmission, postGo } from '@/lib/facturacion/prepare-emission';
import { GoFacturacionError } from '@/lib/facturacion/go-facturacion-client';
import { getHaciendaTokenForUser } from '@/lib/hacienda-auth';
import { resolveCertificatePassword } from '@/lib/facturacion/certificate-credentials';
import { getPostgresPool } from '@/lib/postgres';
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

class GoApiError extends GoFacturacionError {}

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

function cleanDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function lastTwoDigits(value: unknown) {
  const digits = cleanDigits(value);
  if (!digits) return '';
  return digits.slice(-2).padStart(2, '0');
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

async function getCurrentEmitter(uid: string, email: string) {
  const result = await getPostgresPool().query(
    `
      SELECT
        e.*,
        a.nombre AS actividad_nombre
      FROM usuarios u
      INNER JOIN usuario_emisor ue ON ue.usuario_id = u.id
      INNER JOIN emisores e ON e.id = ue.emisor_id
      LEFT JOIN cat_024_codigo_actividad a ON a.codigo = e.codigo_actividad
      WHERE u.activo = TRUE
        AND e.activo = TRUE
        AND (u.firebase_uid = $1 OR lower(u.email) = lower($2))
      ORDER BY CASE ue.rol WHEN 'propietario' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, e.id ASC
      LIMIT 1
    `,
    [uid, email]
  );
  return result.rows[0] ?? null;
}

async function getReceptor(emisorId: number, receptorId: number) {
  const result = await getPostgresPool().query(
    `
      SELECT c.*, a.nombre AS actividad_nombre
      FROM clientes c
      LEFT JOIN cat_024_codigo_actividad a ON a.codigo = c.codigo_actividad
      WHERE c.emisor_id = $1
        AND c.id = $2
        AND c.activo = TRUE
      LIMIT 1
    `,
    [emisorId, receptorId]
  );
  return result.rows[0] ?? null;
}

async function buildTaxCreditReceptor(row: Record<string, unknown>) {
  const nit = cleanDigits(row.numero_documento);
  const direccion = await resolveReceptorDteLocation(row);
  const receptor = {
    nit,
    nrc: normalizeNrc(row.nrc),
    nombre: getString(row.nombre),
    codActividad: getString(row.codigo_actividad),
    descActividad: getString(row.actividad_nombre),
    nombreComercial: nullableString(row.nombre_comercial),
    direccion: {
      ...direccion,
      complemento: getString(row.complemento_direccion),
    },
    telefono: nullableString(row.telefono),
    correo: nullableString(row.correo),
  };

  const missing: string[] = [];
  if (!receptor.nit) missing.push('NIT');
  if (!receptor.nombre) missing.push('nombre');
  if (!receptor.codActividad) missing.push('codigo de actividad');
  if (!receptor.descActividad) missing.push('descripcion de actividad');
  if (!receptor.direccion.departamento) missing.push('departamento');
  if (!receptor.direccion.municipio) missing.push('municipio');
  if (!receptor.direccion.distrito) missing.push('distrito');
  if (!receptor.direccion.complemento) missing.push('direccion');
  if (missing.length) {
    throw new Error(`Completa el receptor para credito fiscal: ${missing.join(', ')}.`);
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

function sumItems(items: ReturnType<typeof validateItems>, ivaPerci = 0, ivaRete = 0) {
  const subTotal = items.reduce((total, item) => {
    const explicit = item.ventaNoSuj + item.ventaExenta + item.ventaGravada + item.noGravado;
    return total + (explicit > 0 ? explicit : item.cantidad * item.precioUni - item.montoDescu);
  }, 0);
  const totalGravada = items.reduce((total, item) => {
    const explicit = item.ventaNoSuj + item.ventaExenta + item.ventaGravada + item.noGravado;
    const ventaGravada = explicit > 0 ? item.ventaGravada : item.cantidad * item.precioUni - item.montoDescu;
    return total + ventaGravada;
  }, 0);
  return subTotal + totalGravada * 0.13 + ivaPerci - ivaRete;
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
      receptorId?: number;
      items?: InvoiceItem[];
      passwordPri?: string;
      transmitir?: boolean;
      environment?: 'test' | 'production';
      observaciones?: string;
      haciendaToken?: string;
      ivaPerci?: number;
      ivaRete?: number;
    };

    const receptorId = Number(body.receptorId || 0);
    if (!receptorId) return NextResponse.json({ error: 'Selecciona un receptor.' }, { status: 400 });

    const prepared = await prepareEmission(user.uid, user.email, '03', body.environment);
    const { emisor, emisorId, environment, ambiente } = prepared;

    const receptor = await getReceptor(emisorId, receptorId);
    if (!receptor) return NextResponse.json({ error: 'Receptor no encontrado para este emisor.' }, { status: 404 });

    const items = validateItems(body.items || []);
    const receptorFiscal = await buildTaxCreditReceptor(receptor);
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
    if (!isValidDteMunicipioCode(receptorFiscal.direccion.municipio)) {
      return NextResponse.json(
        { error: `Municipio del receptor invalido para DTE (CAT-013): ${receptorFiscal.direccion.municipio}. Debe ser codigo de 2 digitos.` },
        { status: 400 }
      );
    }
    const ivaPerci = toNumber(body.ivaPerci);
    const ivaRete = toNumber(body.ivaRete);
    const documentRequest = {
      ambiente,
      correlativo: prepared.sequenceFields.correlativo,
      numeroControl: prepared.sequenceFields.numeroControl,
      establecimientoTipo: prepared.sequenceFields.establecimientoTipo,
      establecimiento: prepared.sequenceFields.establecimiento,
      puntoVenta: prepared.sequenceFields.puntoVenta,
      emisor,
      receptor: receptorFiscal,
      items,
      pagos: [{ codigo: '01', montoPago: Number(sumItems(items, ivaPerci, ivaRete).toFixed(2)) }],
      ivaPerci,
      ivaRete,
      observaciones: nullableString(body.observaciones),
    };

    emisionId = await createEmision('03', {
      uid: user.uid,
      environment,
      tipoDte: '03',
      nit: emisor.nit,
      receptorId,
      status: 'started',
      source: 'tax-credit-invoice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { emisorId });

    const documentStartMs = Date.now();
    const documentResponse = asRecord(await postGo('/api/facturacion/documents/credito-fiscal', documentRequest));
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
        version: Number(documentResponse.version || asRecord(asRecord(dteJson).identificacion).version || 4),
        tipoDte: '03',
        documento: firma,
      };
      try {
        try {
          haciendaResponse = await postGo('/api/facturacion/transmissions/dte', transmissionRequest, {
            headers: { Authorization: token },
          });
        } catch (error) {
          if (!(error instanceof GoApiError) || error.status !== 401) throw error;
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
      tipoDte: '03',
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
    const message = error instanceof Error ? error.message : 'No se pudo emitir credito fiscal';
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
