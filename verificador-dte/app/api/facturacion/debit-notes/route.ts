export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createEmision, getEmisionDataById, mergeEmision } from '@/lib/facturacion/emisiones-store';
import {
  resolveReceptorDteLocation,
} from '@/lib/facturacion/build-emisor';
import { isValidDteMunicipioCode, toDteMunicipioCode } from '@/lib/facturacion/resolve-location';
import { prepareEmission, postGo } from '@/lib/facturacion/prepare-emission';
import { GoFacturacionError } from '@/lib/facturacion/go-facturacion-client';
import { getHaciendaTokenForUser } from '@/lib/hacienda-auth';
import { resolveCertificatePassword } from '@/lib/facturacion/certificate-credentials';
import { getPostgresPool } from '@/lib/postgres';
import { requireAuth } from '@/lib/server-auth';

type JsonRecord = Record<string, unknown>;

type DebitNoteItem = {
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

function normalizeHaciendaToken(value: unknown) {
  return getString(value).replace(/^Bearer\s+/i, '').trim();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
      municipio: toDteMunicipioCode(getString(direccion.departamento), getString(direccion.municipio)),
      distrito: lastTwoDigits(direccion.distrito),
      complemento: getString(direccion.complemento),
    },
    telefono: nullableString(receptor.telefono),
    correo: nullableString(receptor.correo),
  };
}

async function buildNoteReceptorFromDb(row: Record<string, unknown>) {
  const nit = cleanDigits(row.numero_documento);
  const direccion = await resolveReceptorDteLocation(row);
  return {
    tipoDocumento: '36',
    numDocumento: nit,
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
}

function validateItems(items: DebitNoteItem[], relatedCode: string) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Agrega al menos un item para la nota de debito.');
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

export async function POST(req: NextRequest) {
  let emisionId: string | null = null;
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
      items?: DebitNoteItem[];
      transmitir?: boolean;
      environment?: 'test' | 'production';
      observaciones?: string;
      haciendaToken?: string;
      passwordPri?: string;
    };

    const relatedId = String(body.relatedEmissionId || '').trim();
    if (!relatedId) return NextResponse.json({ error: 'Selecciona el credito fiscal relacionado.' }, { status: 400 });
    const receptorId = Number(body.receptorId || 0);
    if (!receptorId) return NextResponse.json({ error: 'Selecciona el receptor de la nota de debito.' }, { status: 400 });

    stage = 'buscar credito fiscal relacionado';
    const relatedData = await getEmisionDataById(relatedId);
    if (!relatedData) return NextResponse.json({ error: 'Credito fiscal relacionado no encontrado.' }, { status: 404 });
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
    if (!relatedCode || !relatedDate) {
      return NextResponse.json({ error: 'El credito fiscal relacionado no tiene codigo o fecha de emision.' }, { status: 400 });
    }

    stage = 'preparar emision';
    const prepared = await prepareEmission(user.uid, user.email, '06', body.environment);
    const { emisor, emisorId, environment, ambiente, sequenceFields } = prepared;
    if (!emisor.nit || !emisor.nrc || !emisor.nombre || !emisor.codActividad || !emisor.descActividad) {
      return NextResponse.json(
        { error: 'Completa NIT, NRC, nombre y actividad economica del emisor antes de emitir nota de debito.', stage },
        { status: 400 }
      );
    }
    if (!emisor.direccion.departamento || !emisor.direccion.municipio || !emisor.direccion.distrito || !emisor.direccion.complemento) {
      return NextResponse.json(
        { error: 'Completa departamento, municipio, distrito y direccion del emisor antes de emitir nota de debito.', stage },
        { status: 400 }
      );
    }
    if (!isValidDteMunicipioCode(emisor.direccion.municipio)) {
      return NextResponse.json(
        { error: `Municipio del emisor invalido para DTE (CAT-013): ${emisor.direccion.municipio}. Debe ser codigo de 2 digitos.`, stage },
        { status: 400 }
      );
    }

    stage = 'buscar receptor';
    const receptorRow = await getReceptor(emisorId, receptorId);
    if (!receptorRow) return NextResponse.json({ error: 'Receptor no encontrado para este emisor.' }, { status: 404 });
    if (relatedData.receptorId && Number(relatedData.receptorId) !== receptorId) {
      return NextResponse.json(
        { error: 'La nota de debito debe emitirse al mismo receptor del credito fiscal relacionado.', stage },
        { status: 400 }
      );
    }

    stage = 'armar receptor';
    const receptor = await buildNoteReceptorFromDb(receptorRow);
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
    if (!isValidDteMunicipioCode(receptor.direccion.municipio)) {
      return NextResponse.json(
        { error: `Municipio del receptor invalido para DTE (CAT-013): ${receptor.direccion.municipio}. Debe ser codigo de 2 digitos.`, stage },
        { status: 400 }
      );
    }

    stage = 'validar items';
    const items = validateItems(body.items || [], relatedCode);

    const documentRequest = {
      ambiente,
      correlativo: sequenceFields.correlativo,
      numeroControl: sequenceFields.numeroControl,
      establecimientoTipo: sequenceFields.establecimientoTipo,
      establecimiento: sequenceFields.establecimiento,
      puntoVenta: sequenceFields.puntoVenta,
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

    stage = 'crear registro supabase';
    emisionId = await createEmision('06', {
      uid: user.uid,
      environment,
      tipoDte: '06',
      nit: emisor.nit,
      receptorId: relatedData.receptorId || null,
      selectedReceptorId: receptorId,
      relatedEmisionId: relatedId,
      relatedId,
      relatedCodigoGeneracion: relatedCode,
      status: 'started',
      source: 'debit-note',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { emisorId });

    stage = 'generar nota en go';
    const documentStartMs = Date.now();
    const documentResponse = asRecord(await postGo('/api/facturacion/documents/nota-debito', documentRequest));
    const documentEndMs = Date.now();
    processTiming.documentCreatedAt = new Date(documentEndMs).toISOString();
    processTiming.documentCreationMs = documentEndMs - documentStartMs;

    const dteJson = documentResponse.dteJson;
    const codigoGeneracion = getString(documentResponse.codigoGeneracion);
    const numeroControl = getString(documentResponse.numeroControl);
    const totalPagar = Number(documentResponse.totalPagar || 0);

    stage = 'guardar documento generado';
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
      await mergeEmision(emisionId, {
        status: 'signed',
        processTiming,
        signResponse: { success: asRecord(signResponse).success, firma },
        updatedAt: new Date().toISOString(),
      });
    }

    if (body.transmitir !== false) {
      if (!firma) return NextResponse.json({ error: 'Clave privada requerida para firmar antes de transmitir.' }, { status: 400 });
      stage = 'obtener token hacienda';
      let token = normalizeHaciendaToken(body.haciendaToken) || await getHaciendaTokenForUser(user.uid, false, environment);
      const haciendaStartMs = Date.now();
      processTiming.sentToHaciendaAt = new Date(haciendaStartMs).toISOString();
      const transmissionRequest = {
        environment,
        ambiente,
        idEnvio: Date.now(),
        version: Number(documentResponse.version || asRecord(asRecord(dteJson).identificacion).version || 4),
        tipoDte: '06',
        documento: firma,
      };
      try {
        try {
          stage = 'transmitir nota a go';
          haciendaResponse = await postGo('/api/facturacion/transmissions/dte', transmissionRequest, {
            headers: { Authorization: token },
          });
        } catch (error) {
          if (!(error instanceof GoFacturacionError) || error.status !== 401) throw error;
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
      tipoDte: '06',
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
        json: `/api/facturacion/emissions/${emisionId}/json`,
        pdf: `/api/facturacion/emissions/${emisionId}/pdf`,
      },
    };
    const status = selloRecepcion ? 'received' : firma ? 'signed' : 'document_created';
    await mergeEmision(emisionId, {
      status,
      selloRecepcion,
      selloRecibido: selloRecepcion,
      haciendaResponse,
      processTiming,
      finalPackage: final,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: emisionId, status, codigoGeneracion, numeroControl, totalPagar, selloRecepcion, processTiming, finalPackage: final });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : '';
    const message = rawMessage.trim() || `No se pudo emitir nota de debito en etapa: ${stage}`;
    processTiming.totalMs = Date.now() - requestStartedAtMs;
    if (emisionId) {
      await mergeEmision(emisionId, { status: 'error', error: message, errorStage: stage, processTiming, updatedAt: new Date().toISOString() }).catch(() => {});
    }
    return NextResponse.json({ error: message, stage, processTiming }, { status: 500 });
  }
}

