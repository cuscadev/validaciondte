export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getGoDteApiUrl } from '@/lib/go-dte-api';
import { getHaciendaTokenForUser } from '@/lib/hacienda-auth';
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

type ResolvedLocation = {
  departamento: string;
  municipio: string;
  distrito: string;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
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
    municipio: rawMunicipio,
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
    throw new Error(
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error?: unknown }).error)
        : text || `Go API respondio HTTP ${upstream.status}`
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
    if (precioUni <= 0 && toNumber(item.ventaGravada) <= 0 && toNumber(item.ventaExenta) <= 0 && toNumber(item.ventaNoSuj) <= 0) {
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
    };
  });
}

function sumItems(items: ReturnType<typeof validateItems>) {
  return items.reduce((total, item) => {
    const explicit = item.ventaNoSuj + item.ventaExenta + item.ventaGravada;
    return total + (explicit > 0 ? explicit : item.cantidad * item.precioUni - item.montoDescu);
  }, 0);
}

export async function POST(req: NextRequest) {
  let runRef: FirebaseFirestore.DocumentReference | null = null;

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

    runRef = adminDb.collection('facturacionEmisiones').doc();
    await runRef.set({
      uid: user.uid,
      environment,
      tipoDte: '01',
      nit: emisor.nit,
      receptorId,
      status: 'started',
      source: 'consumer-invoice',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const documentResponse = asRecord(await postGo(
      '/api/facturacion/documents/factura-consumidor-final',
      documentRequest
    ));

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
      updatedAt: new Date(),
    }, { merge: true });

    let firma = '';
    let signResponse: unknown = null;
    let haciendaResponse: unknown = null;
    let selloRecepcion = '';
    const passwordPri = String(body.passwordPri || '');

    if (passwordPri) {
      signResponse = await postGo('/api/facturacion/sign', {
        nit: emisor.nit,
        passwordPri,
        dteJson,
      });
      firma = getString(asRecord(signResponse).firma);

      await runRef.set({
        status: 'signed',
        signResponse: {
          success: asRecord(signResponse).success,
          firma,
        },
        updatedAt: new Date(),
      }, { merge: true });
    }

    if (body.transmitir !== false) {
      if (!firma) {
        return NextResponse.json(
          { error: 'Clave privada requerida para firmar antes de transmitir.' },
          { status: 400 }
        );
      }

      const token = await getHaciendaTokenForUser(user.uid, false, environment);
      haciendaResponse = await postGo('/api/facturacion/transmissions/dte', {
        environment,
        ambiente: '00',
        idEnvio: Date.now(),
        version: Number(documentResponse.version || asRecord(asRecord(dteJson).identificacion).version || 2),
        tipoDte: '01',
        documento: firma,
      }, {
        headers: { Authorization: token },
      });
      selloRecepcion = extractSello(haciendaResponse);
    }

    const finalPackage = {
      tipoDte: '01',
      codigoGeneracion,
      numeroControl,
      totalPagar,
      dteJson,
      firma,
      selloRecepcion,
      haciendaResponse,
      downloads: {
        json: `/api/facturacion/test-flow/factura/${runRef.id}/json`,
      },
    };

    const status = selloRecepcion
      ? 'received'
      : firma
        ? 'signed'
        : 'document_created';

    await runRef.set({
      status,
      selloRecepcion,
      haciendaResponse,
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
      finalPackage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo facturar consumidor final';
    if (runRef) {
      await runRef.set({
        status: 'error',
        error: message,
        updatedAt: new Date(),
      }, { merge: true }).catch(() => {});
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
