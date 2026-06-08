export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getGoDteApiUrl } from '@/lib/go-dte-api';
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

class GoApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GoApiError';
    this.status = status;
  }
}

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

function municipioDteCode(departamento: string, municipio: string) {
  const muniDigits = cleanDigits(municipio);
  if (!muniDigits) return '';
  return muniDigits.slice(-2).padStart(2, '0');
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

async function postGo(path: string, body: unknown, init?: RequestInit) {
  const upstream = await fetch(`${getGoDteApiUrl()}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const text = await upstream.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!upstream.ok) {
    throw new GoApiError(
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error?: unknown }).error)
        : text || `Go API respondio HTTP ${upstream.status}`,
      upstream.status
    );
  }

  return payload;
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

function buildEmitter(row: Record<string, unknown>) {
  return {
    nit: cleanDigits(row.nit),
    nrc: normalizeNrc(row.nrc, true),
    nombre: getString(row.nombre),
    codActividad: getString(row.codigo_actividad),
    descActividad: getString(row.descripcion_actividad).trim() || getString(row.actividad_nombre).trim(),
    nombreComercial: nullableString(row.nombre_comercial),
    tipoEstablecimiento: getString(row.tipo_establecimiento_codigo) || '01',
    direccion: {
      departamento: getString(row.departamento_codigo),
      municipio: municipioDteCode(getString(row.departamento_codigo), getString(row.municipio_codigo)),
      distrito: lastTwoDigits(row.distrito_codigo),
      complemento: getString(row.complemento_direccion),
    },
    telefono: getString(row.telefono),
    correo: getString(row.correo),
    codEstable: null,
    codPuntoVenta: null,
  };
}

function buildTaxCreditReceptor(row: Record<string, unknown>) {
  const nit = cleanDigits(row.numero_documento);
  const receptor = {
    nit,
    nrc: normalizeNrc(row.nrc),
    nombre: getString(row.nombre),
    codActividad: getString(row.codigo_actividad),
    descActividad: getString(row.actividad_nombre),
    nombreComercial: nullableString(row.nombre_comercial),
    direccion: {
      departamento: getString(row.departamento_codigo),
      municipio: municipioDteCode(getString(row.departamento_codigo), getString(row.municipio_codigo)),
      distrito: lastTwoDigits(row.distrito_codigo),
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
  return items.reduce((total, item) => {
    const explicit = item.ventaNoSuj + item.ventaExenta + item.ventaGravada + item.noGravado;
    return total + (explicit > 0 ? explicit : item.cantidad * item.precioUni - item.montoDescu);
  }, 0) + ivaPerci - ivaRete;
}

export async function POST(req: NextRequest) {
  let runRef: FirebaseFirestore.DocumentReference | null = null;
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

    const emitter = await getCurrentEmitter(user.uid, user.email);
    if (!emitter) return NextResponse.json({ error: 'No hay emisor vinculado para este usuario.' }, { status: 404 });

    const receptorId = Number(body.receptorId || 0);
    if (!receptorId) return NextResponse.json({ error: 'Selecciona un receptor.' }, { status: 400 });

    const receptor = await getReceptor(Number(emitter.id), receptorId);
    if (!receptor) return NextResponse.json({ error: 'Receptor no encontrado para este emisor.' }, { status: 404 });

    const items = validateItems(body.items || []);
    const environment = body.environment === 'production' ? 'production' : 'test';
    if (environment !== 'test') {
      return NextResponse.json({ error: 'Por ahora solo se permite ambiente test.' }, { status: 400 });
    }

    const emisor = buildEmitter(emitter);
    const receptorFiscal = buildTaxCreditReceptor(receptor);
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
    if (!/^\d{2}$/.test(emisor.direccion.municipio)) {
      return NextResponse.json(
        { error: `Municipio del emisor invalido para DTE: ${emisor.direccion.municipio}. Debe tener 2 digitos.` },
        { status: 400 }
      );
    }
    if (!/^\d{2}$/.test(receptorFiscal.direccion.municipio)) {
      return NextResponse.json(
        { error: `Municipio del receptor invalido para DTE: ${receptorFiscal.direccion.municipio}. Debe tener 2 digitos.` },
        { status: 400 }
      );
    }
    const ivaPerci = toNumber(body.ivaPerci);
    const ivaRete = toNumber(body.ivaRete);
    const documentRequest = {
      ambiente: '00',
      correlativo: Date.now() % 999999999999999,
      establecimientoTipo: 'M',
      establecimiento: '001',
      puntoVenta: '001',
      emisor,
      receptor: receptorFiscal,
      items,
      pagos: [{ codigo: '01', montoPago: Number(sumItems(items, ivaPerci, ivaRete).toFixed(2)) }],
      ivaPerci,
      ivaRete,
      observaciones: nullableString(body.observaciones),
    };

    runRef = adminDb.collection('facturacionEmisiones').doc();
    await runRef.set({
      uid: user.uid,
      environment,
      tipoDte: '03',
      nit: emisor.nit,
      receptorId,
      status: 'started',
      source: 'tax-credit-invoice',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const documentStartMs = Date.now();
    const documentResponse = asRecord(await postGo('/api/facturacion/documents/credito-fiscal', documentRequest));
    const documentEndMs = Date.now();
    processTiming.documentCreatedAt = new Date(documentEndMs).toISOString();
    processTiming.documentCreationMs = documentEndMs - documentStartMs;

    const dteJson = documentResponse.dteJson;
    const codigoGeneracion = getString(documentResponse.codigoGeneracion);
    const numeroControl = getString(documentResponse.numeroControl);
    const totalPagar = Number(documentResponse.totalPagar || 0);

    await runRef.set({
      status: 'document_created',
      documentRequest,
      documentResponse,
      codigoGeneracion,
      numeroControl,
      totalPagar,
      processTiming,
      updatedAt: new Date(),
    }, { merge: true });

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
      await runRef.set({
        status: 'signed',
        processTiming,
        signResponse: { success: asRecord(signResponse).success, firma },
        updatedAt: new Date(),
      }, { merge: true });
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
        ambiente: '00',
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
        json: `/api/facturacion/emissions/${runRef.id}/json`,
        pdf: `/api/facturacion/emissions/${runRef.id}/pdf`,
      },
    };

    const status = selloRecepcion ? 'received' : firma ? 'signed' : 'document_created';
    await runRef.set({
      status,
      selloRecepcion,
      haciendaResponse,
      processTiming,
      finalPackage,
      updatedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      id: runRef.id,
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
    if (runRef) {
      await runRef.set({
        status: 'error',
        error: message,
        processTiming,
        updatedAt: new Date(),
      }, { merge: true }).catch(() => {});
    }
    return NextResponse.json({ error: message, processTiming }, { status: 500 });
  }
}
