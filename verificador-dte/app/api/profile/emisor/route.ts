import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { buildDteDireccionPreview } from '@/lib/facturacion/location-catalog-options';
import {
  LocationValidationError,
  normalizeLocationCode,
  resolveLocation,
  sanitizeLocationCodeForForm,
  sanitizeLocationCodeForStorage,
} from '@/lib/facturacion/resolve-location';
import { requiresDistritoForMunicipio } from '@/lib/facturacion/ubicacion-maps';
import { getPostgresPool } from '@/lib/postgres';

export const runtime = 'nodejs';

type EmitterInput = {
  nit?: string;
  nrc?: string;
  nombre?: string;
  nombreComercial?: string;
  razonSocial?: string;
  tipoEstablecimientoCodigo?: string;
  codigoActividad?: string;
  descripcionActividad?: string;
  departamentoCodigo?: string;
  municipioCodigo?: string;
  distritoCodigo?: string;
  complementoDireccion?: string;
  telefono?: string;
  correo?: string;
  regimenTributarioCodigo?: string;
  tipoAfiliacionCodigo?: string;
  ambienteCodigo?: string;
  // Configuración de facturación
  metodoPagoDefecto?: string;
  formaPagoDefecto?: string;
  plazoCredito?: string;
  tipoVentaDefecto?: string;
  monedaDefecto?: string;
  tasaIva?: number;
  generadorCodigo?: string;
  prefijoCorrelativo?: string;
  tipoRetencionDefecto?: string;
  codEstable?: string;
  codPuntoVenta?: string;
  tipoEstablecimientoEmision?: string;
};

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function clean(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanRequired(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function upsertEmisorConfiguracion(
  emisorId: number,
  body: EmitterInput
) {
  const pool = getPostgresPool();
  const hasConfig =
    body.metodoPagoDefecto !== undefined ||
    body.formaPagoDefecto !== undefined ||
    body.plazoCredito !== undefined ||
    body.tipoVentaDefecto !== undefined ||
    body.monedaDefecto !== undefined ||
    body.tasaIva !== undefined ||
    body.generadorCodigo !== undefined ||
    body.prefijoCorrelativo !== undefined ||
    body.tipoRetencionDefecto !== undefined ||
    body.codEstable !== undefined ||
    body.codPuntoVenta !== undefined ||
    body.tipoEstablecimientoEmision !== undefined;

  if (!hasConfig) return;

  await pool.query(
    `
      INSERT INTO emisor_configuracion (
        emisor_id,
        metodo_pago_defecto,
        forma_pago_defecto,
        plazo_credito_defecto,
        tipo_venta_defecto,
        moneda_defecto,
        tasa_iva,
        generador_codigo,
        prefijo_correlativo,
        tipo_retencion_defecto,
        cod_estable,
        cod_punto_venta,
        tipo_establecimiento_emision,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
      ON CONFLICT (emisor_id)
      DO UPDATE SET
        metodo_pago_defecto = COALESCE(EXCLUDED.metodo_pago_defecto, emisor_configuracion.metodo_pago_defecto),
        forma_pago_defecto = COALESCE(EXCLUDED.forma_pago_defecto, emisor_configuracion.forma_pago_defecto),
        plazo_credito_defecto = COALESCE(EXCLUDED.plazo_credito_defecto, emisor_configuracion.plazo_credito_defecto),
        tipo_venta_defecto = COALESCE(EXCLUDED.tipo_venta_defecto, emisor_configuracion.tipo_venta_defecto),
        moneda_defecto = COALESCE(EXCLUDED.moneda_defecto, emisor_configuracion.moneda_defecto),
        tasa_iva = COALESCE(EXCLUDED.tasa_iva, emisor_configuracion.tasa_iva),
        generador_codigo = COALESCE(EXCLUDED.generador_codigo, emisor_configuracion.generador_codigo),
        prefijo_correlativo = COALESCE(EXCLUDED.prefijo_correlativo, emisor_configuracion.prefijo_correlativo),
        tipo_retencion_defecto = COALESCE(EXCLUDED.tipo_retencion_defecto, emisor_configuracion.tipo_retencion_defecto),
        cod_estable = COALESCE(EXCLUDED.cod_estable, emisor_configuracion.cod_estable),
        cod_punto_venta = COALESCE(EXCLUDED.cod_punto_venta, emisor_configuracion.cod_punto_venta),
        tipo_establecimiento_emision = COALESCE(EXCLUDED.tipo_establecimiento_emision, emisor_configuracion.tipo_establecimiento_emision),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      emisorId,
      clean(body.metodoPagoDefecto),
      clean(body.formaPagoDefecto),
      clean(body.plazoCredito),
      clean(body.tipoVentaDefecto),
      clean(body.monedaDefecto),
      typeof body.tasaIva === 'number' && Number.isFinite(body.tasaIva) ? body.tasaIva : null,
      clean(body.generadorCodigo),
      clean(body.prefijoCorrelativo),
      clean(body.tipoRetencionDefecto),
      clean(body.codEstable),
      clean(body.codPuntoVenta),
      clean(body.tipoEstablecimientoEmision),
    ]
  );
}

async function getIdentity(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) return null;

  const decoded = await adminAuth.verifyIdToken(token);
  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
  const user = userDoc.exists ? userDoc.data() || {} : {};

  if (user.disabled) {
    throw new Error('Tu usuario esta bloqueado. Contacta al administrador.');
  }

  return {
    uid: decoded.uid,
    email: String(decoded.email || user.email || '').trim().toLowerCase(),
    role: String(user.role || decoded.role || ''),
  };
}

async function getLinkedEmitter(uid: string, email: string) {
  const pool = getPostgresPool();

  const result = await pool.query(
    `
      SELECT
        e.id,
        e.nit,
        e.nrc,
        e.nombre,
        e.nombre_comercial AS "nombreComercial",
        e.razon_social AS "razonSocial",
        e.tipo_establecimiento_codigo AS "tipoEstablecimientoCodigo",
        e.codigo_actividad AS "codigoActividad",
        COALESCE(NULLIF(BTRIM(e.descripcion_actividad), ''), a.nombre) AS "descripcionActividad",
        e.departamento_codigo AS "departamentoCodigo",
        e.municipio_codigo AS "municipioCodigo",
        e.distrito_codigo AS "distritoCodigo",
        e.complemento_direccion AS "complementoDireccion",
        e.telefono,
        e.correo,
        e.regimen_tributario_codigo AS "regimenTributarioCodigo",
        e.tipo_afiliacion_codigo AS "tipoAfiliacionCodigo",
        e.ambiente_codigo AS "ambienteCodigo",
        e.certificado_path AS "certificadoPath",
        e.fecha_vencimiento_cert AS "fechaVencimientoCert",
        e.activo,
        ue.rol AS "rolEmisor",
        ec.metodo_pago_defecto AS "metodoPagoDefecto",
        ec.forma_pago_defecto AS "formaPagoDefecto",
        ec.plazo_credito_defecto AS "plazoCredito",
        ec.tipo_venta_defecto AS "tipoVentaDefecto",
        ec.moneda_defecto AS "monedaDefecto",
        ec.tasa_iva AS "tasaIva",
        ec.generador_codigo AS "generadorCodigo",
        ec.prefijo_correlativo AS "prefijoCorrelativo",
        ec.tipo_retencion_defecto AS "tipoRetencionDefecto",
        ec.cod_estable AS "codEstable",
        ec.cod_punto_venta AS "codPuntoVenta",
        ec.tipo_establecimiento_emision AS "tipoEstablecimientoEmision"
      FROM usuarios u
      INNER JOIN usuario_emisor ue ON ue.usuario_id = u.id
      INNER JOIN emisores e ON e.id = ue.emisor_id
      LEFT JOIN cat_024_codigo_actividad a ON a.codigo = e.codigo_actividad
      LEFT JOIN emisor_configuracion ec ON ec.emisor_id = e.id
      WHERE u.activo = TRUE
        AND e.activo = TRUE
        AND (u.firebase_uid = $1 OR lower(u.email) = lower($2))
      ORDER BY
        CASE ue.rol WHEN 'propietario' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
        e.id ASC
      LIMIT 1
    `,
    [uid, email]
  );

  return result.rows[0] ?? null;
}

async function ensureLocalUser(identity: { uid: string; email: string; role: string }) {
  const pool = getPostgresPool();
  const role = identity.role === 'superadmin' ? 'superadmin' : identity.role === 'colaborador' ? 'colaborador' : 'cliente';
  const result = await pool.query<{ id: number }>(
    `
      INSERT INTO usuarios (
        firebase_uid,
        email,
        nombre,
        rol,
        activo,
        updated_at
      )
      VALUES ($1, $2, $2, $3, TRUE, CURRENT_TIMESTAMP)
      ON CONFLICT (firebase_uid)
      DO UPDATE SET
        email = EXCLUDED.email,
        rol = EXCLUDED.rol,
        activo = TRUE,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `,
    [identity.uid, identity.email, role]
  );

  return result.rows[0].id;
}

function canUpdateEmitter(role: string, emitterRole: string) {
  if (role === 'superadmin') return true;
  return emitterRole === 'propietario' || emitterRole === 'editor';
}

function sanitizeEmitterResponse(emitter: Record<string, unknown>) {
  const departamentoCodigo =
    sanitizeLocationCodeForForm(emitter.departamentoCodigo) || emitter.departamentoCodigo;
  const municipioCodigo = sanitizeLocationCodeForForm(emitter.municipioCodigo);
  const distritoCodigo = sanitizeLocationCodeForForm(emitter.distritoCodigo);
  const complementoDireccion =
    typeof emitter.complementoDireccion === 'string' ? emitter.complementoDireccion : '';
  const direccionHacienda = buildDteDireccionPreview(
    String(departamentoCodigo ?? ''),
    municipioCodigo,
    distritoCodigo,
    complementoDireccion
  );

  return {
    ...emitter,
    departamentoCodigo,
    municipioCodigo,
    distritoCodigo,
    municipioCodigoDte: direccionHacienda?.municipio ?? null,
    direccionHacienda,
  };
}

export async function GET(req: NextRequest) {
  try {
    const identity = await getIdentity(req);
    if (!identity) return json({ error: 'No autorizado' }, { status: 401 });

    const emitter = await getLinkedEmitter(identity.uid, identity.email);
    if (!emitter) {
      return json(
        { error: 'No hay emisor vinculado a tu usuario local.' },
        { status: 404 }
      );
    }

    return json({ emitter: sanitizeEmitterResponse(emitter) });
  } catch (error) {
    console.error('[api/profile/emisor] Error loading emitter', error);

    return json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: error instanceof Error && error.message.includes('bloqueado') ? 403 : 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const identity = await getIdentity(req);
    if (!identity) return json({ error: 'No autorizado' }, { status: 401 });

    const body = (await req.json()) as EmitterInput;
    const nit = cleanRequired(body.nit);
    const nrc = cleanRequired(body.nrc);
    const nombre = cleanRequired(body.nombre);

    if (!nit || !nrc || !nombre) {
      return json(
        { error: 'NIT, NRC y nombre del emisor son obligatorios.' },
        { status: 400 }
      );
    }

    const pool = getPostgresPool();
    let location = null as Awaited<ReturnType<typeof resolveLocation>>;

    if (body.departamentoCodigo || body.municipioCodigo || body.distritoCodigo) {
      const municipioCodigo = normalizeLocationCode(body.municipioCodigo);
      try {
        location = await resolveLocation(
          pool,
          {
            departamentoCodigo: body.departamentoCodigo,
            municipioCodigo: body.municipioCodigo,
            distritoCodigo: body.distritoCodigo,
          },
          {
            requireDistrito:
              Boolean(body.distritoCodigo) || requiresDistritoForMunicipio(municipioCodigo),
          }
        );
      } catch (error) {
        if (error instanceof LocationValidationError) {
          return json({ error: error.message }, { status: error.status });
        }
        throw error;
      }
    }

    if (!location) {
      return json(
        { error: 'Selecciona departamento, municipio y distrito validos del catalogo.' },
        { status: 400 }
      );
    }

    const municipioCodigo = location.municipioCodigo;
    const distritoCodigo = location.distritoCodigo ?? '';
    const departamentoCodigo = location.departamentoCodigo;

    let current = await getLinkedEmitter(identity.uid, identity.email);
    if (!current) {
      if (identity.role !== 'cliente' && identity.role !== 'superadmin') {
        return json(
          { error: 'No hay emisor vinculado a tu usuario local.' },
          { status: 404 }
        );
      }

      const usuarioId = await ensureLocalUser(identity);
      const created = await pool.query(
        `
          INSERT INTO emisores (
            nit,
            nrc,
            nombre,
            nombre_comercial,
            razon_social,
            tipo_establecimiento_codigo,
            codigo_actividad,
            descripcion_actividad,
            departamento_codigo,
            municipio_codigo,
            distrito_codigo,
            complemento_direccion,
            telefono,
            correo,
            regimen_tributario_codigo,
            tipo_afiliacion_codigo,
            usuario_id,
            activo,
            ambiente_codigo,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, TRUE, COALESCE($18, '00'), CURRENT_TIMESTAMP
          )
          ON CONFLICT (nit)
          DO UPDATE SET
            nrc = EXCLUDED.nrc,
            nombre = EXCLUDED.nombre,
            nombre_comercial = EXCLUDED.nombre_comercial,
            razon_social = EXCLUDED.razon_social,
            tipo_establecimiento_codigo = EXCLUDED.tipo_establecimiento_codigo,
            codigo_actividad = EXCLUDED.codigo_actividad,
            descripcion_actividad = EXCLUDED.descripcion_actividad,
            departamento_codigo = EXCLUDED.departamento_codigo,
            municipio_codigo = EXCLUDED.municipio_codigo,
            distrito_codigo = EXCLUDED.distrito_codigo,
            complemento_direccion = EXCLUDED.complemento_direccion,
            telefono = EXCLUDED.telefono,
            correo = EXCLUDED.correo,
            regimen_tributario_codigo = EXCLUDED.regimen_tributario_codigo,
            tipo_afiliacion_codigo = EXCLUDED.tipo_afiliacion_codigo,
            usuario_id = EXCLUDED.usuario_id,
            activo = TRUE,
            ambiente_codigo = EXCLUDED.ambiente_codigo,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `,
        [
          nit,
          nrc,
          nombre,
          clean(body.nombreComercial),
          clean(body.razonSocial),
          clean(body.tipoEstablecimientoCodigo),
          clean(body.codigoActividad),
          clean(body.descripcionActividad),
          departamentoCodigo,
          municipioCodigo,
          distritoCodigo,
          clean(body.complementoDireccion),
          clean(body.telefono),
          clean(body.correo),
          clean(body.regimenTributarioCodigo),
          clean(body.tipoAfiliacionCodigo),
          usuarioId,
          clean(body.ambienteCodigo),
        ]
      );

      await pool.query(
        `
          INSERT INTO usuario_emisor (usuario_id, emisor_id, rol)
          VALUES ($1, $2, 'propietario')
          ON CONFLICT (usuario_id, emisor_id)
          DO UPDATE SET rol = EXCLUDED.rol
        `,
        [usuarioId, created.rows[0].id]
      );

      current = await getLinkedEmitter(identity.uid, identity.email);
    }

    if (!current) {
      return json({ error: 'No se pudo vincular el emisor.' }, { status: 500 });
    }

    if (!canUpdateEmitter(identity.role, String(current.rolEmisor || ''))) {
      return json(
        { error: 'No tienes permiso para modificar este emisor.' },
        { status: 403 }
      );
    }

    await pool.query(
      `
        UPDATE emisores
        SET
          nit = $1,
          nrc = $2,
          nombre = $3,
          nombre_comercial = $4,
          razon_social = $5,
          tipo_establecimiento_codigo = $6,
          codigo_actividad = $7,
          descripcion_actividad = $8,
          departamento_codigo = $9,
          municipio_codigo = $10,
          distrito_codigo = $11,
          complemento_direccion = $12,
          telefono = $13,
          correo = $14,
          regimen_tributario_codigo = $15,
          tipo_afiliacion_codigo = $16,
          ambiente_codigo = COALESCE($17, ambiente_codigo),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $18
        RETURNING
          id,
          nit,
          nrc,
          nombre,
          nombre_comercial AS "nombreComercial",
          razon_social AS "razonSocial",
          tipo_establecimiento_codigo AS "tipoEstablecimientoCodigo",
          codigo_actividad AS "codigoActividad",
          descripcion_actividad AS "descripcionActividad",
          departamento_codigo AS "departamentoCodigo",
          municipio_codigo AS "municipioCodigo",
          distrito_codigo AS "distritoCodigo",
          complemento_direccion AS "complementoDireccion",
          telefono,
          correo,
          regimen_tributario_codigo AS "regimenTributarioCodigo",
          tipo_afiliacion_codigo AS "tipoAfiliacionCodigo",
          ambiente_codigo AS "ambienteCodigo",
          certificado_path AS "certificadoPath",
          fecha_vencimiento_cert AS "fechaVencimientoCert",
          activo
      `,
      [
        nit,
        nrc,
        nombre,
        clean(body.nombreComercial),
        clean(body.razonSocial),
        clean(body.tipoEstablecimientoCodigo),
        clean(body.codigoActividad),
        clean(body.descripcionActividad),
        departamentoCodigo,
        municipioCodigo,
        distritoCodigo,
        clean(body.complementoDireccion),
        clean(body.telefono),
        clean(body.correo),
        clean(body.regimenTributarioCodigo),
        clean(body.tipoAfiliacionCodigo),
        clean(body.ambienteCodigo),
        current.id,
      ]
    );

    await upsertEmisorConfiguracion(Number(current.id), body);

    const emitter = await getLinkedEmitter(identity.uid, identity.email);

    return json({
      emitter: sanitizeEmitterResponse({
        ...emitter,
        rolEmisor: current.rolEmisor,
      }),
    });
  } catch (error) {
    console.error('[api/profile/emisor] Error updating emitter', error);

    const message =
      error instanceof Error ? error.message : 'Error interno al guardar emisor';
    const status = message.includes('duplicate key') ? 409 : 500;

    return json({ error: message }, { status });
  }
}
