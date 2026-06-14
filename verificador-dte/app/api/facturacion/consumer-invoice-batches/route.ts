export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { adminDb } from '@/lib/firebase-admin';
import { resolveEmitterForDte } from '@/lib/facturacion/build-emisor';
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
  tipoItem?: number;
};

class GoApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'GoApiError';
    this.status = status;
    this.payload = payload;
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeHaciendaToken(value: unknown) {
  return getString(value).replace(/^Bearer\s+/i, '').trim();
}

function decodeHaciendaToken(token: string) {
  const raw = normalizeHaciendaToken(token);
  const [, payload] = raw.split('.');
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      sub?: string;
      c_nit?: string;
      exp?: number;
      iat?: number;
    };
  } catch {
    return null;
  }
}

function validateHaciendaTokenForLote(token: string, nitEmisor: string, environment: 'test' | 'production') {
  const normalized = normalizeHaciendaToken(token);
  if (!normalized) {
    throw new Error('Token de Hacienda requerido para transmitir el lote.');
  }
  if (!normalized.startsWith('eyJ')) {
    throw new Error('Token de Hacienda invalido: debe ser JWT crudo, sin prefijo Bearer.');
  }

  const claims = decodeHaciendaToken(normalized);
  if (!claims) return normalized;

  if (claims.exp && claims.exp * 1000 <= Date.now() + 30_000) {
    throw new Error(`Token de Hacienda expirado el ${new Date(claims.exp * 1000).toISOString()}.`);
  }

  const tokenNit = cleanDigits(claims.c_nit || claims.sub);
  const expectedNit = cleanDigits(nitEmisor);
  if (tokenNit && expectedNit && tokenNit !== expectedNit) {
    throw new Error(`Token de Hacienda no corresponde al NIT emisor configurado (${tokenNit} != ${expectedNit}).`);
  }

  if (environment !== 'test') {
    throw new Error('Por ahora solo se permite transmitir lotes en ambiente test.');
  }

  return normalized;
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

function normalizeText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
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
    const payloadMessage =
      typeof payload === 'object' && payload
        ? JSON.stringify(payload)
        : typeof payload === 'string'
          ? payload
          : '';
    const message = typeof payload === 'object' && payload && 'error' in payload
      ? String((payload as { error?: unknown }).error)
      : payloadMessage || text || `Go API respondio HTTP ${upstream.status}`;
    throw new GoApiError(message || `Go API respondio HTTP ${upstream.status}`, upstream.status, payload);
  }

  return payload;
}

async function getCurrentEmitter(uid: string, email: string) {
  const result = await getPostgresPool().query(
    `
      SELECT
        e.id,
        e.nit,
        e.nrc,
        e.nombre,
        e.nombre_comercial,
        e.tipo_establecimiento_codigo,
        e.codigo_actividad,
        e.descripcion_actividad,
        e.departamento_codigo,
        e.municipio_codigo,
        e.distrito_codigo,
        e.complemento_direccion,
        e.telefono,
        e.correo,
        e.ambiente_codigo,
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
      SELECT
        c.*,
        a.nombre AS actividad_nombre
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

function buildReceptor(row: Record<string, unknown>) {
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
    };
  });
}

function sumItems(items: ReturnType<typeof validateItems>) {
  return items.reduce((total, item) => {
    const explicit = item.ventaNoSuj + item.ventaExenta + item.ventaGravada;
    return total + (explicit > 0 ? explicit : item.cantidad * item.precioUni - item.montoDescu);
  }, 0);
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function chunkLoteDocuments<T>(items: T[], chunkSize: number) {
  const chunks = chunkArray(items, chunkSize);
  const last = chunks[chunks.length - 1];
  const previous = chunks[chunks.length - 2];
  if (last?.length === 1 && previous?.length > 2) {
    last.unshift(previous.pop()!);
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  let runRef: FirebaseFirestore.DocumentReference | null = null;
  const startedAt = Date.now();

  try {
    const user = await requireAuth(req);
    if (user.role !== 'cliente' && user.role !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      receptorId?: number;
      items?: InvoiceItem[];
      batchSize?: number;
      chunkSize?: number;
      passwordPri?: string;
      transmitir?: boolean;
      environment?: 'test' | 'production';
      observaciones?: string;
      haciendaToken?: string;
    };

    const batchSize = Math.max(1, Math.min(1000, Math.floor(Number(body.batchSize || 1))));
    const chunkLimit = body.transmitir !== false ? 100 : batchSize;
    const minChunkSize = body.transmitir !== false ? 2 : 1;
    const chunkSize = Math.max(
      minChunkSize,
      Math.min(batchSize, chunkLimit, Math.floor(Number(body.chunkSize || batchSize)))
    );
    const environment = body.environment === 'production' ? 'production' : 'test';
    if (environment !== 'test') {
      return NextResponse.json({ error: 'Por ahora solo se permite ambiente test.' }, { status: 400 });
    }
    if (body.transmitir !== false && batchSize < 2) {
      return NextResponse.json({ error: 'El envio por lote requiere al menos 2 documentos.' }, { status: 400 });
    }

    const emitter = await getCurrentEmitter(user.uid, user.email);
    if (!emitter) {
      return NextResponse.json({ error: 'No hay emisor vinculado para este usuario.' }, { status: 404 });
    }

    const receptorId = Number(body.receptorId || 0);
    if (!receptorId) {
      return NextResponse.json({ error: 'Selecciona un receptor.' }, { status: 400 });
    }

    const receptor = await getReceptor(Number(emitter.id), receptorId);
    if (!receptor) {
      return NextResponse.json({ error: 'Receptor no encontrado para este emisor.' }, { status: 404 });
    }

    const items = validateItems(body.items || []);
    const { emisor } = await resolveEmitterForDte(emitter);
    if (!emisor.codActividad || !emisor.descActividad) {
      return NextResponse.json(
        { error: 'Configura el codigo y descripcion de actividad economica del emisor antes de facturar.' },
        { status: 400 }
      );
    }

    const passwordPri = await resolveCertificatePassword(user.uid, body.passwordPri);
    if (!passwordPri) {
      return NextResponse.json({ error: 'Clave privada requerida para firmar el lote.' }, { status: 400 });
    }

    runRef = adminDb.collection('facturacionLotes').doc();
    await runRef.set({
      uid: user.uid,
      environment,
      tipoDte: '01',
      nit: emisor.nit,
      receptorId,
      batchSize,
      chunkSize,
      status: 'started',
      source: 'consumer-invoice-batch',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Get Hacienda token once (needed for document creation and transmission)
    const haciendaToken = validateHaciendaTokenForLote(
      normalizeHaciendaToken(body.haciendaToken) || await getHaciendaTokenForUser(user.uid, false, environment),
      emisor.nit,
      environment
    );

    const documentStartedAt = Date.now();
    const documents = await Promise.all(Array.from({ length: batchSize }, async (_, index) => {
      const request = {
        ambiente: '00',
        correlativo: (Date.now() + index) % 999999999999999,
        establecimientoTipo: 'M',
        establecimiento: '001',
        puntoVenta: '001',
        emisor,
        receptor: buildReceptor(receptor),
        items: items.map((item) => ({
          ...item,
          codigo: item.codigo ? `${item.codigo}-${String(index + 1).padStart(3, '0')}` : null,
        })),
        pagos: [{ codigo: '01', montoPago: Number(sumItems(items).toFixed(2)) }],
        observaciones: nullableString(`${body.observaciones || 'Prueba de emision por lote'} #${index + 1}`),
      };
      const response = asRecord(await postGo('/api/facturacion/documents/factura-consumidor-final', request, {
        headers: { Authorization: haciendaToken },
      }));
      return {
        index: index + 1,
        request,
        response,
        dteJson: response.dteJson,
        codigoGeneracion: getString(response.codigoGeneracion),
        numeroControl: getString(response.numeroControl),
        version: Number(response.version || asRecord(asRecord(response.dteJson).identificacion).version || 2),
      };
    }));
    const documentCreationMs = Date.now() - documentStartedAt;

    const rows: Array<{
      index: number;
      chunk: number;
      codigoGeneracion: string;
      numeroControl: string;
      version: number;
      firma: string;
      signSuccess: boolean;
      signError: string;
      codigoLote: string;
    }> = [];
    const chunks = [];
    let signingMs = 0;
    let haciendaMs = 0;
    let token = haciendaToken;

    const documentChunks = body.transmitir !== false
      ? chunkLoteDocuments(documents, chunkSize)
      : chunkArray(documents, chunkSize);
    for (let chunkIndex = 0; chunkIndex < documentChunks.length; chunkIndex += 1) {
      const chunkDocuments = documentChunks[chunkIndex];
      const chunkStartedAt = Date.now();
      const signStartedAt = Date.now();
      const signResponse = asRecord(await postGo('/api/facturacion/sign/batch', {
        nit: emisor.nit,
        passwordPri,
        documentos: chunkDocuments.map((document) => ({
          id: String(document.index),
          dteJson: document.dteJson,
        })),
      }));
      const chunkSigningMs = Date.now() - signStartedAt;
      signingMs += chunkSigningMs;
      const signedDocuments = Array.isArray(signResponse.documentos) ? signResponse.documentos.map(asRecord) : [];

      const chunkRows = chunkDocuments.map((document) => {
        const signed = signedDocuments.find((item) => getString(item.id) === String(document.index));
        return {
          index: document.index,
          chunk: chunkIndex + 1,
          codigoGeneracion: document.codigoGeneracion,
          numeroControl: document.numeroControl,
          version: document.version,
          firma: getString(signed?.firma),
          signSuccess: Boolean(signed?.success),
          signError: getString(signed?.error),
          codigoLote: '',
        };
      });

      const failedSign = chunkRows.find((row) => !row.signSuccess || !row.firma);
      if (failedSign) {
        rows.push(...chunkRows);
        await runRef.set({
          status: 'sign_error',
          documents,
          chunks,
          rows,
          timing: { documentCreationMs, signingMs, haciendaMs, totalMs: Date.now() - startedAt },
          updatedAt: new Date(),
        }, { merge: true });
        return NextResponse.json(
          { error: failedSign.signError || `No se pudo firmar documento ${failedSign.index}`, rows, chunks },
          { status: 400 }
        );
      }

      let loteResponse: unknown = null;
      let codigoLote = '';
      let chunkHaciendaMs = 0;
      if (body.transmitir !== false) {
        const haciendaStartedAt = Date.now();
        const loteRequest = {
          environment,
          ambiente: '00',
          idEnvio: randomUUID().toUpperCase(),
          version: 1,
          nitEmisor: emisor.nit,
          documentos: chunkRows.map((row) => ({
            tipoDte: '01',
            version: row.version,
            codigoGeneracion: row.codigoGeneracion,
            documento: row.firma,
          })),
        };
        try {
          try {
            loteResponse = await postGo('/api/facturacion/transmissions/lote', loteRequest, {
              headers: { Authorization: token },
            });
          } catch (error) {
            if (!(error instanceof GoApiError) || error.status !== 401) {
              throw error;
            }
            token = validateHaciendaTokenForLote(
              await getHaciendaTokenForUser(user.uid, true, environment),
              emisor.nit,
              environment
            );
            loteResponse = await postGo('/api/facturacion/transmissions/lote', loteRequest, {
              headers: { Authorization: token },
            });
          }
          codigoLote = getString(asRecord(loteResponse).codigoLote) || getString(asRecord(loteResponse).codigoGeneracion);
        } catch (error) {
          const statusSuffix = error instanceof GoApiError ? ` HTTP ${error.status}` : '';
          loteResponse = {
            error: error instanceof Error ? error.message : 'No se pudo transmitir chunk',
            status: error instanceof GoApiError ? error.status : undefined,
            haciendaPayload: error instanceof GoApiError ? error.payload : undefined,
          };
          const payloadDetail = error instanceof GoApiError && error.payload
            ? ` Respuesta Hacienda/Go: ${typeof error.payload === 'string' ? error.payload : JSON.stringify(error.payload)}`
            : '';
          throw new Error(
            error instanceof Error
              ? `No se pudo transmitir chunk ${chunkIndex + 1} a Hacienda${statusSuffix}: ${error.message}.${payloadDetail}`
              : `No se pudo transmitir chunk ${chunkIndex + 1} a Hacienda`
          );
        } finally {
          chunkHaciendaMs = Date.now() - haciendaStartedAt;
          haciendaMs += chunkHaciendaMs;
        }
      }

      const chunkRowsWithLote = chunkRows.map((row) => ({ ...row, codigoLote }));
      rows.push(...chunkRowsWithLote);
      chunks.push({
        index: chunkIndex + 1,
        size: chunkRows.length,
        codigoLote,
        signingMs: chunkSigningMs,
        haciendaMs: chunkHaciendaMs,
        totalMs: Date.now() - chunkStartedAt,
        loteResponse,
      });
    }

    const timing = {
      documentCreationMs,
      signingMs,
      haciendaMs,
      totalMs: Date.now() - startedAt,
    };

    const codigosLote = chunks.map((chunk) => chunk.codigoLote).filter(Boolean);

    await runRef.set({
      status: body.transmitir !== false ? 'lote_sent' : 'signed',
      codigoLote: codigosLote.join(','),
      codigosLote,
      chunks,
      rows,
      timing,
      updatedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      id: runRef.id,
      status: body.transmitir !== false ? 'lote_sent' : 'signed',
      codigoLote: codigosLote.join(','),
      codigosLote,
      chunks,
      rows: rows.map((row) => ({
        index: row.index,
        chunk: row.chunk,
        codigoGeneracion: row.codigoGeneracion,
        numeroControl: row.numeroControl,
        version: row.version,
        signSuccess: row.signSuccess,
        signError: row.signError,
        codigoLote: row.codigoLote,
      })),
      timing,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo emitir lote';
    if (runRef) {
      await runRef.set({
        status: 'error',
        error: message,
        timing: { totalMs: Date.now() - startedAt },
        updatedAt: new Date(),
      }, { merge: true }).catch(() => {});
    }
    return NextResponse.json(
      { error: message, timing: { totalMs: Date.now() - startedAt } },
      { status: 500 }
    );
  }
}
