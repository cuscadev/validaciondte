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

type CreditNoteItem = {
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

function municipioDteCode(_departamento: string, municipio: string) {
  return lastTwoDigits(municipio);
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
  const parsed = parseMaybeJson(response);
  const direct = asRecord(parsed);
  return (
    getString(direct.selloRecibido) ||
    getString(direct.selloRecepcion) ||
    getString(deepFind(parsed, 'selloRecibido')) ||
    getString(deepFind(parsed, 'selloRecepcion'))
  );
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function deepFind(value: unknown, key: string): unknown {
  const parsed = parseMaybeJson(value);
  if (!parsed || typeof parsed !== 'object') return undefined;
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const found = deepFind(item, key);
      if (found != null && found !== '') return found;
    }
    return undefined;
  }
  const record = parsed as JsonRecord;
  if (record[key] != null && record[key] !== '') return record[key];
  for (const item of Object.values(record)) {
    const found = deepFind(item, key);
    if (found != null && found !== '') return found;
  }
  return undefined;
}

async function getCurrentEmitter(uid: string, email: string) {
  const result = await getPostgresPool().query(
    `
      SELECT e.*, a.nombre AS actividad_nombre
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

function buildNoteReceptorFromDte(receptor: JsonRecord) {
  const nit = cleanDigits(receptor.nit || receptor.numDocumento);
  const direccion = asRecord(receptor.direccion);
  return {
    tipoDocumento: '36',
    numDocumento: nit,
    nrc: normalizeNrc(receptor.nrc),
    nombre: getString(receptor.nombre),
    codActividad: getString(receptor.codActividad),
    descActividad: getString(receptor.descActividad),
    nombreComercial: nullableString(receptor.nombreComercial),
    direccion: {
      departamento: getString(direccion.departamento),
      municipio: municipioDteCode(getString(direccion.departamento), getString(direccion.municipio)),
      distrito: lastTwoDigits(direccion.distrito),
      complemento: getString(direccion.complemento),
    },
    telefono: nullableString(receptor.telefono),
    correo: nullableString(receptor.correo),
  };
}

function buildNoteReceptorFromDb(row: Record<string, unknown>) {
  const nit = cleanDigits(row.numero_documento);
  return {
    tipoDocumento: '36',
    numDocumento: nit,
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
}

function validateItems(items: CreditNoteItem[], relatedCode: string) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Agrega al menos un item para la nota de credito.');
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
      numeroDocumento: relatedCode,
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

function estimateTotal(items: ReturnType<typeof validateItems>) {
  const subtotal = items.reduce((total, item) => {
    const explicit = item.ventaNoSuj + item.ventaExenta + item.ventaGravada + item.noGravado;
    return total + (explicit > 0 ? explicit : item.cantidad * item.precioUni - item.montoDescu);
  }, 0);
  const totalGravada = items.reduce((total, item) => {
    const explicit = item.ventaNoSuj + item.ventaExenta + item.ventaGravada + item.noGravado;
    const gravada = explicit > 0 ? item.ventaGravada : item.cantidad * item.precioUni - item.montoDescu;
    return total + gravada;
  }, 0);
  return Number((subtotal + totalGravada * 0.13).toFixed(2));
}

export async function POST(req: NextRequest) {
  let runRef: FirebaseFirestore.DocumentReference | null = null;
  let stage = 'inicio';
  const requestStartedAtMs = Date.now();
  const processTiming: ProcessTiming = { startedAt: new Date(requestStartedAtMs).toISOString() };

  try {
    stage = 'autenticacion';
    const user = await requireAuth(req);
    if (user.role !== 'cliente' && user.role !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    stage = 'leer body';
    const body = (await req.json().catch(() => ({}))) as {
      relatedEmissionId?: string;
      receptorId?: number;
      items?: CreditNoteItem[];
      transmitir?: boolean;
      environment?: 'test' | 'production';
      observaciones?: string;
      haciendaToken?: string;
      passwordPri?: string;
    };

    const relatedId = String(body.relatedEmissionId || '').trim();
    if (!relatedId) return NextResponse.json({ error: 'Selecciona el credito fiscal relacionado.' }, { status: 400 });
    const receptorId = Number(body.receptorId || 0);
    if (!receptorId) return NextResponse.json({ error: 'Selecciona el receptor de la nota de credito.' }, { status: 400 });

    stage = 'buscar credito fiscal relacionado';
    const relatedSnap = await adminDb.collection('facturacionEmisiones').doc(relatedId).get();
    if (!relatedSnap.exists) return NextResponse.json({ error: 'Credito fiscal relacionado no encontrado.' }, { status: 404 });
    const relatedData = relatedSnap.data() || {};
    if (user.role !== 'superadmin' && relatedData.uid !== user.uid) {
      return NextResponse.json({ error: 'No autorizado para usar este credito fiscal.' }, { status: 403 });
    }
    if (String(relatedData.tipoDte || '') !== '03') {
      return NextResponse.json({ error: 'El documento relacionado debe ser un credito fiscal tipo 03.' }, { status: 400 });
    }

    const finalPackage = asRecord(relatedData.finalPackage || relatedData);
    const rawRelatedDte = finalPackage.dteJson || asRecord(relatedData.documentResponse).dteJson;
    const relatedDte = typeof rawRelatedDte === 'string'
      ? asRecord(JSON.parse(rawRelatedDte))
      : asRecord(rawRelatedDte);
    const relatedIdent = asRecord(relatedDte.identificacion);
    const relatedCode = getString(relatedData.codigoGeneracion || relatedIdent.codigoGeneracion);
    const relatedDate = getString(relatedIdent.fecEmi);
    const relatedTotal = Number(relatedData.totalPagar || asRecord(relatedDte.resumen).totalPagar || 0);
    if (!relatedCode || !relatedDate) {
      return NextResponse.json({ error: 'El credito fiscal relacionado no tiene codigo o fecha de emision.' }, { status: 400 });
    }

    stage = 'buscar emisor';
    const emitter = await getCurrentEmitter(user.uid, user.email);
    if (!emitter) return NextResponse.json({ error: 'No hay emisor vinculado para este usuario.' }, { status: 404 });

    const environment = body.environment === 'production' ? 'production' : 'test';
    if (environment !== 'test') return NextResponse.json({ error: 'Por ahora solo se permite ambiente test.' }, { status: 400 });

    const emisor = buildEmitter(emitter);
    if (!emisor.nit || !emisor.nrc || !emisor.nombre || !emisor.codActividad || !emisor.descActividad) {
      return NextResponse.json(
        { error: 'Completa NIT, NRC, nombre y actividad economica del emisor antes de emitir nota de credito.', stage },
        { status: 400 }
      );
    }
    if (!emisor.direccion.departamento || !emisor.direccion.municipio || !emisor.direccion.distrito || !emisor.direccion.complemento) {
      return NextResponse.json(
        { error: 'Completa departamento, municipio, distrito y direccion del emisor antes de emitir nota de credito.', stage },
        { status: 400 }
      );
    }
    if (!/^\d{2}$/.test(emisor.direccion.municipio)) {
      return NextResponse.json(
        { error: `Municipio del emisor invalido para DTE: ${emisor.direccion.municipio}. Debe tener 2 digitos.`, stage },
        { status: 400 }
      );
    }

    stage = 'buscar receptor';
    const receptorRow = await getReceptor(Number(emitter.id), receptorId);
    if (!receptorRow) return NextResponse.json({ error: 'Receptor no encontrado para este emisor.' }, { status: 404 });
    if (relatedData.receptorId && Number(relatedData.receptorId) !== receptorId) {
      return NextResponse.json(
        { error: 'La nota de credito debe emitirse al mismo receptor del credito fiscal relacionado.', stage },
        { status: 400 }
      );
    }

    stage = 'armar receptor';
    const receptor = buildNoteReceptorFromDb(receptorRow);
    const receptorRelacionado = buildNoteReceptorFromDte(asRecord(relatedDte.receptor));
    if (receptorRelacionado.numDocumento && receptorRelacionado.numDocumento !== receptor.numDocumento) {
      return NextResponse.json(
        { error: 'El receptor seleccionado no coincide con el receptor del CCF relacionado.', stage },
        { status: 400 }
      );
    }
    if (!receptor.numDocumento || !receptor.nombre || !receptor.codActividad || !receptor.descActividad) {
      return NextResponse.json(
        { error: 'El receptor del CCF relacionado no tiene NIT, nombre o actividad economica completos.', stage },
        { status: 400 }
      );
    }
    if (!receptor.direccion.departamento || !receptor.direccion.municipio || !receptor.direccion.distrito || !receptor.direccion.complemento) {
      return NextResponse.json(
        { error: 'El receptor del CCF relacionado no tiene direccion completa.', stage },
        { status: 400 }
      );
    }
    if (!/^\d{2}$/.test(receptor.direccion.municipio)) {
      return NextResponse.json(
        { error: `Municipio del receptor invalido para DTE: ${receptor.direccion.municipio}. Debe tener 2 digitos.`, stage },
        { status: 400 }
      );
    }

    stage = 'validar items';
    const items = validateItems(body.items || [], relatedCode);
    const noteTotal = estimateTotal(items);
    if (noteTotal > Number((relatedTotal + 0.001).toFixed(3))) {
      return NextResponse.json(
        { error: `La nota de credito no puede superar el total del CCF relacionado (${relatedTotal.toFixed(2)}).` },
        { status: 400 }
      );
    }

    const documentRequest = {
      ambiente: '00',
      correlativo: Date.now() % 999999999999999,
      establecimientoTipo: 'M',
      establecimiento: '001',
      puntoVenta: '001',
      emisor,
      receptor,
      documentoRelacionado: [{
        tipoDocumento: '03',
        tipoGeneracion: 2,
        numeroDocumento: relatedCode,
        fechaEmision: relatedDate,
      }],
      items,
      observaciones: nullableString(body.observaciones),
    };

    stage = 'crear registro firebase';
    runRef = adminDb.collection('facturacionEmisiones').doc();
    await runRef.set({
      uid: user.uid,
      environment,
      tipoDte: '05',
      nit: emisor.nit,
      receptorId: relatedData.receptorId || null,
      selectedReceptorId: receptorId,
      relatedEmissionId: relatedId,
      relatedCodigoGeneracion: relatedCode,
      status: 'started',
      source: 'credit-note',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    stage = 'generar nota en go';
    const documentStartMs = Date.now();
    const documentResponse = asRecord(await postGo('/api/facturacion/documents/nota-credito', documentRequest));
    const documentEndMs = Date.now();
    processTiming.documentCreatedAt = new Date(documentEndMs).toISOString();
    processTiming.documentCreationMs = documentEndMs - documentStartMs;

    const dteJson = documentResponse.dteJson;
    const codigoGeneracion = getString(documentResponse.codigoGeneracion);
    const numeroControl = getString(documentResponse.numeroControl);
    const totalPagar = Number(documentResponse.totalPagar || 0);

    stage = 'guardar documento generado';
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
    stage = 'resolver contrasena certificado';
    const passwordPri = await resolveCertificatePassword(user.uid, body.passwordPri);

    if (passwordPri) {
      stage = 'firmar nota en go';
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
      if (!firma) return NextResponse.json({ error: 'Clave privada requerida para firmar antes de transmitir.' }, { status: 400 });
      stage = 'obtener token hacienda';
      let token = normalizeHaciendaToken(body.haciendaToken) || await getHaciendaTokenForUser(user.uid, false, environment);
      const haciendaStartMs = Date.now();
      processTiming.sentToHaciendaAt = new Date(haciendaStartMs).toISOString();
      const transmissionRequest = {
        environment,
        ambiente: '00',
        idEnvio: Date.now(),
        version: Number(documentResponse.version || asRecord(asRecord(dteJson).identificacion).version || 4),
        tipoDte: '05',
        documento: firma,
      };
      try {
        try {
          stage = 'transmitir nota a go';
          haciendaResponse = await postGo('/api/facturacion/transmissions/dte', transmissionRequest, {
            headers: { Authorization: token },
          });
        } catch (error) {
          if (!(error instanceof GoApiError) || error.status !== 401) throw error;
          stage = 'refrescar token hacienda';
          token = await getHaciendaTokenForUser(user.uid, true, environment);
          stage = 'retransmitir nota a go';
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

    stage = 'guardar resultado final';
    processTiming.totalMs = Date.now() - requestStartedAtMs;
    const final = {
      tipoDte: '05',
      codigoGeneracion,
      numeroControl,
      totalPagar,
      dteJson,
      firma,
      selloRecepcion,
      selloRecibido: selloRecepcion,
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
      selloRecibido: selloRecepcion,
      haciendaResponse,
      processTiming,
      finalPackage: final,
      updatedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({ success: true, id: runRef.id, status, codigoGeneracion, numeroControl, totalPagar, selloRecepcion, processTiming, finalPackage: final });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : '';
    const message = rawMessage.trim() || `No se pudo emitir nota de credito en etapa: ${stage}`;
    processTiming.totalMs = Date.now() - requestStartedAtMs;
    if (runRef) {
      await runRef.set({ status: 'error', error: message, errorStage: stage, processTiming, updatedAt: new Date() }, { merge: true }).catch(() => {});
    }
    return NextResponse.json({ error: message, stage, processTiming }, { status: 500 });
  }
}
