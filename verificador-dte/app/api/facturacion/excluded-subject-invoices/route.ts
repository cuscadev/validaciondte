export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createEmision, mergeEmision } from '@/lib/facturacion/emisiones-store';
import { getGoDteApiUrl } from '@/lib/go-dte-api';
import { getHaciendaTokenForUser } from '@/lib/hacienda-auth';
import { resolveCertificatePassword } from '@/lib/facturacion/certificate-credentials';
import { getPostgresPool } from '@/lib/postgres';
import { requireAuth } from '@/lib/server-auth';

type JsonRecord = Record<string, unknown>;

type ExcludedSubjectItem = {
  codigo?: string;
  descripcion?: string;
  cantidad?: number;
  uniMedida?: number;
  precioUni?: number;
  montoDescu?: number;
  compra?: number;
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

function municipioDteCode(value: unknown) {
  return lastTwoDigits(value);
}

function normalizeNrc(value: unknown, required = false) {
  const nrc = cleanDigits(value);
  if (!nrc) return required ? '' : null;
  if (nrc.length > 8) return required ? nrc.slice(0, 8) : null;
  return nrc;
}

function normalizeHaciendaToken(value: unknown) {
  return getString(value).replace(/^Bearer\s+/i, '').trim();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function inferTipoDocumento(numeroDocumento: unknown) {
  const digits = cleanDigits(numeroDocumento);
  if (digits.length === 14) return '36';
  if (digits.length === 9) return '13';
  return null;
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
    direccion: {
      departamento: getString(row.departamento_codigo),
      municipio: municipioDteCode(row.municipio_codigo),
      distrito: lastTwoDigits(row.distrito_codigo),
      complemento: getString(row.complemento_direccion),
    },
    telefono: getString(row.telefono),
    correo: getString(row.correo),
    codEstable: null,
    codPuntoVenta: null,
  };
}

function buildExcludedSubjectReceptor(row: Record<string, unknown>) {
  const receptor = {
    tipoDocumento: nullableString(row.tipo_documento_codigo) || inferTipoDocumento(row.numero_documento),
    numDocumento: cleanDigits(row.numero_documento),
    nombre: getString(row.nombre),
    codActividad: nullableString(row.codigo_actividad),
    descActividad: nullableString(row.actividad_nombre),
    direccion: {
      departamento: getString(row.departamento_codigo),
      municipio: municipioDteCode(row.municipio_codigo),
      distrito: lastTwoDigits(row.distrito_codigo),
      complemento: getString(row.complemento_direccion),
    },
    telefono: nullableString(row.telefono),
    correo: nullableString(row.correo),
  };

  const missing: string[] = [];
  if (!receptor.tipoDocumento) missing.push('tipo de documento');
  if (!receptor.numDocumento) missing.push('numero de documento');
  if (!receptor.nombre) missing.push('nombre');
  if (!receptor.direccion.departamento) missing.push('departamento');
  if (!receptor.direccion.municipio) missing.push('municipio');
  if (!receptor.direccion.distrito) missing.push('distrito');
  if (!receptor.direccion.complemento) missing.push('direccion');
  if (missing.length) {
    throw new Error(`Completa el sujeto excluido: ${missing.join(', ')}.`);
  }
  if (!/^\d{2}$/.test(receptor.direccion.municipio)) {
    throw new Error(`Municipio del sujeto excluido invalido para DTE: ${receptor.direccion.municipio}. Debe tener 2 digitos.`);
  }

  return receptor;
}

function validateItems(items: ExcludedSubjectItem[]) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Agrega al menos un item para facturar sujeto excluido.');
  }

  return items.map((item, index) => {
    const descripcion = String(item.descripcion || '').trim();
    const cantidad = toNumber(item.cantidad);
    const precioUni = toNumber(item.precioUni);
    const montoDescu = toNumber(item.montoDescu);
    const compra = toNumber(item.compra) || Math.max(0, cantidad * precioUni - montoDescu);

    if (!descripcion) throw new Error(`Item ${index + 1}: descripcion requerida.`);
    if (cantidad <= 0) throw new Error(`Item ${index + 1}: cantidad debe ser mayor a cero.`);
    if (precioUni <= 0 && compra <= 0) throw new Error(`Item ${index + 1}: precio unitario o compra requerida.`);

    return {
      tipoItem: Number(item.tipoItem || 2),
      codigo: nullableString(item.codigo),
      descripcion,
      cantidad,
      uniMedida: Number(item.uniMedida || 59),
      precioUni,
      montoDescu,
      compra: Number(compra.toFixed(2)),
    };
  });
}

function sumCompras(items: ReturnType<typeof validateItems>) {
  return items.reduce((total, item) => total + item.compra, 0);
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
      items?: ExcludedSubjectItem[];
      passwordPri?: string;
      transmitir?: boolean;
      environment?: 'test' | 'production';
      observaciones?: string;
      haciendaToken?: string;
      reteRenta?: number;
    };

    const emitter = await getCurrentEmitter(user.uid, user.email);
    if (!emitter) return NextResponse.json({ error: 'No hay emisor vinculado para este usuario.' }, { status: 404 });

    const receptorId = Number(body.receptorId || 0);
    if (!receptorId) return NextResponse.json({ error: 'Selecciona un sujeto excluido.' }, { status: 400 });

    const receptor = await getReceptor(Number(emitter.id), receptorId);
    if (!receptor) return NextResponse.json({ error: 'Sujeto excluido no encontrado para este emisor.' }, { status: 404 });

    const items = validateItems(body.items || []);
    const environment = body.environment === 'production' ? 'production' : 'test';
    if (environment !== 'test') {
      return NextResponse.json({ error: 'Por ahora solo se permite ambiente test.' }, { status: 400 });
    }

    const emisor = buildEmitter(emitter);
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

    const reteRenta = Math.max(0, toNumber(body.reteRenta));
    const totalCompra = Number(sumCompras(items).toFixed(2));
    const totalPagarEstimado = Number(Math.max(0, totalCompra - reteRenta).toFixed(2));
    const documentRequest = {
      ambiente: '00',
      correlativo: Date.now() % 999999999999999,
      establecimientoTipo: 'M',
      establecimiento: '001',
      puntoVenta: '001',
      emisor,
      receptor: buildExcludedSubjectReceptor(receptor),
      items,
      pagos: [{ codigo: '01', montoPago: totalPagarEstimado }],
      reteRenta,
      observaciones: nullableString(body.observaciones),
    };

    emisionId = await createEmision('14', {
      uid: user.uid,
      environment,
      tipoDte: '14',
      nit: emisor.nit,
      receptorId,
      status: 'started',
      source: 'excluded-subject-invoice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { emisorId: Number(emitter.id) });

    const documentStartMs = Date.now();
    const documentResponse = asRecord(await postGo('/api/facturacion/documents/sujeto-excluido', documentRequest));
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
        ambiente: '00',
        idEnvio: Date.now(),
        version: Number(documentResponse.version || asRecord(asRecord(dteJson).identificacion).version || 2),
        tipoDte: '14',
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
      tipoDte: '14',
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
    const message = error instanceof Error ? error.message : 'No se pudo emitir sujeto excluido';
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
