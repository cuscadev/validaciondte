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

type ResolvedLocation = {
  departamento: string;
  municipio: string;
  distrito: string;
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

function normalizeText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function normalizeMunicipioCodigo(value: unknown) {
  return lastTwoDigits(value);
}

function municipioDteCode(departamento: string, municipio: string) {
  const muniDigits = cleanDigits(municipio);
  if (!muniDigits) return '';
  return muniDigits.slice(-2).padStart(2, '0');
}

async function resolveEmitterLocation(row: Record<string, unknown>): Promise<ResolvedLocation> {
  const departamento = getString(row.departamento_codigo);
  const rawMunicipio = normalizeMunicipioCodigo(
    row.municipio_codigo
  );
  const complemento = normalizeText(row.complemento_direccion);
  const pool = getPostgresPool();

  let resolvedMunicipio: { id: number; codigo: string; nombre: string } | undefined;
  const municipio = await pool.query<{ id: number; codigo: string; nombre: string }>(
    `
      SELECT id, codigo, nombre
      FROM cat_006_municipios
      WHERE codigo = $1
        AND departamento_codigo = $2
        AND COALESCE(activo, TRUE) = TRUE
      LIMIT 1
    `,
    [rawMunicipio, departamento]
  );
  resolvedMunicipio = municipio.rows[0];

  if (!resolvedMunicipio) {
    const candidates = await pool.query<{ id: number; codigo: string; nombre: string }>(
      `
        SELECT id, codigo, nombre
        FROM cat_006_municipios
        WHERE departamento_codigo = $1
          AND COALESCE(activo, TRUE) = TRUE
        ORDER BY codigo
      `,
      [departamento]
    );
    const matched = candidates.rows.find((candidate) =>
      complemento.includes(normalizeText(candidate.nombre))
    );
    if (matched) {
      resolvedMunicipio = matched;
    }
  }

  const rawDistrito = lastTwoDigits(row.distrito_codigo);
  let distrito = '';

  if (resolvedMunicipio) {
    const validDistrito = await pool.query<{ codigo: string }>(
      `
        SELECT codigo
        FROM cat_008_distritos
        WHERE municipio_id = $1
          AND departamento_codigo = $2
          AND codigo = $3
          AND COALESCE(activo, TRUE) = TRUE
        LIMIT 1
      `,
      [resolvedMunicipio.id, departamento, rawDistrito]
    );

    if (validDistrito.rows[0]) {
      distrito = validDistrito.rows[0].codigo;
    } else {
      const fallbackDistrito = await pool.query<{ codigo: string }>(
        `
          SELECT codigo
          FROM cat_008_distritos
          WHERE municipio_id = $1
            AND departamento_codigo = $2
            AND COALESCE(activo, TRUE) = TRUE
          ORDER BY codigo
          LIMIT 1
        `,
        [resolvedMunicipio.id, departamento]
      );
      distrito = fallbackDistrito.rows[0]?.codigo || '';
    }
  }

  return {
    departamento,
    municipio: resolvedMunicipio ? municipioDteCode(departamento, resolvedMunicipio.codigo) : '',
    distrito,
  };
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
        e.id,
        e.nit,
        e.nrc,
        e.nombre,
        e.nombre_comercial,
        e.razon_social,
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
        m.nombre AS municipio_nombre,
        a.nombre AS actividad_nombre,
        ue.rol AS rol_emisor
      FROM usuarios u
      INNER JOIN usuario_emisor ue ON ue.usuario_id = u.id
      INNER JOIN emisores e ON e.id = ue.emisor_id
      LEFT JOIN cat_006_municipios m ON m.codigo = e.municipio_codigo
        AND m.departamento_codigo = e.departamento_codigo
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

function buildEmitter(row: Record<string, unknown>, location: ResolvedLocation) {
  return {
    nit: cleanDigits(row.nit),
    nrc: normalizeNrc(row.nrc, true),
    nombre: getString(row.nombre),
    codActividad: getString(row.codigo_actividad),
    descActividad: getString(row.descripcion_actividad).trim() || getString(row.actividad_nombre).trim(),
    nombreComercial: nullableString(row.nombre_comercial),
    tipoEstablecimiento: getString(row.tipo_establecimiento_codigo) || '01',
    direccion: {
      departamento: location.departamento,
      municipio: location.municipio,
      distrito: location.distrito,
      complemento: getString(row.complemento_direccion),
    },
    telefono: getString(row.telefono),
    correo: getString(row.correo),
    codEstable: null,
    codPuntoVenta: null,
  };
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

function sumItems(items: ReturnType<typeof validateItems>) {
  return items.reduce((total, item) => {
    const explicit = item.ventaNoSuj + item.ventaExenta + item.ventaGravada + item.noGravado;
    return total + (explicit > 0 ? explicit : item.cantidad * item.precioUni - item.montoDescu);
  }, 0);
}

export async function POST(req: NextRequest) {
  let emisionId: string | null = null;
  const requestStartedAtMs = Date.now();
  const processTiming: ProcessTiming = {
    startedAt: new Date(requestStartedAtMs).toISOString(),
  };

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
    };

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
    const environment = body.environment === 'production' ? 'production' : 'test';
    if (environment !== 'test') {
      return NextResponse.json({ error: 'Por ahora solo se permite ambiente test.' }, { status: 400 });
    }

    const emisor = buildEmitter(emitter, await resolveEmitterLocation(emitter));
    if (!emisor.codActividad || !emisor.descActividad) {
      return NextResponse.json(
        { error: 'Configura el codigo y descripcion de actividad economica del emisor antes de facturar.' },
        { status: 400 }
      );
    }
    if (!emisor.direccion.departamento || !emisor.direccion.municipio || !emisor.direccion.distrito) {
      return NextResponse.json(
        { error: 'Configura departamento, municipio y distrito validos del emisor antes de facturar.' },
        { status: 400 }
      );
    }
    if (!/^\d{2}$/.test(emisor.direccion.municipio)) {
      return NextResponse.json(
        { error: `Municipio del emisor invalido para DTE: ${emisor.direccion.municipio}. Debe tener 2 digitos.` },
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
      receptor: buildReceptor(receptor),
      items,
      pagos: [
        {
          codigo: '01',
          montoPago: Number(sumItems(items).toFixed(2)),
        },
      ],
      observaciones: nullableString(body.observaciones),
    };

    emisionId = await createEmision('01', {
      uid: user.uid,
      environment,
      tipoDte: '01',
      nit: emisor.nit,
      receptorId,
      status: 'started',
      source: 'consumer-invoice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { emisorId: Number(emitter.id) });

    const documentStartMs = Date.now();
    const documentResponse = asRecord(await postGo(
      '/api/facturacion/documents/factura-consumidor-final',
      documentRequest
    ));
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
      signResponse = await postGo('/api/facturacion/sign', {
        nit: emisor.nit,
        passwordPri,
        dteJson,
      });
      const signEndMs = Date.now();
      processTiming.signedAt = new Date(signEndMs).toISOString();
      processTiming.signingMs = signEndMs - signStartMs;
      firma = getString(asRecord(signResponse).firma);

      await mergeEmision(emisionId, {
        status: 'signed',
        processTiming,
        signResponse: {
          success: asRecord(signResponse).success,
          firma,
        },
        updatedAt: new Date().toISOString(),
      });
    }

    if (body.transmitir !== false) {
      if (!firma) {
        return NextResponse.json(
          { error: 'Clave privada requerida para firmar antes de transmitir.' },
          { status: 400 }
        );
      }

      let token = normalizeHaciendaToken(body.haciendaToken) ||
        await getHaciendaTokenForUser(user.uid, false, environment);
      const haciendaStartMs = Date.now();
      processTiming.sentToHaciendaAt = new Date(haciendaStartMs).toISOString();
      try {
        const transmissionRequest = {
          environment,
          ambiente: '00',
          idEnvio: Date.now(),
          version: Number(documentResponse.version || asRecord(asRecord(dteJson).identificacion).version || 2),
          tipoDte: '01',
          documento: firma,
        };
        try {
          haciendaResponse = await postGo('/api/facturacion/transmissions/dte', transmissionRequest, {
            headers: { Authorization: token },
          });
        } catch (error) {
          if (!(error instanceof GoApiError) || error.status !== 401) {
            throw error;
          }
          token = await getHaciendaTokenForUser(user.uid, true, environment);
          haciendaResponse = await postGo('/api/facturacion/transmissions/dte', transmissionRequest, {
            headers: { Authorization: token },
          });
        }
      } catch (error) {
        const haciendaEndMs = Date.now();
        processTiming.receivedFromHaciendaAt = new Date(haciendaEndMs).toISOString();
        processTiming.haciendaMs = haciendaEndMs - haciendaStartMs;
        throw error;
      }
      const haciendaEndMs = Date.now();
      processTiming.receivedFromHaciendaAt = new Date(haciendaEndMs).toISOString();
      processTiming.haciendaMs = haciendaEndMs - haciendaStartMs;
      selloRecepcion = extractSello(haciendaResponse);
    }

    processTiming.totalMs = Date.now() - requestStartedAtMs;

    const finalPackage = {
      tipoDte: '01',
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

    const status = selloRecepcion
      ? 'received'
      : firma
        ? 'signed'
        : 'document_created';

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
    const message = error instanceof Error ? error.message : 'No se pudo facturar consumidor final';
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
