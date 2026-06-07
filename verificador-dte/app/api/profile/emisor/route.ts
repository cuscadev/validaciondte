import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
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

function cleanLastTwoDigits(value: unknown) {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  return digits.slice(-2).padStart(2, '0');
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
        ec.tipo_retencion_defecto AS "tipoRetencionDefecto"
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

    return json({ emitter });
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
    const municipioCodigo = cleanLastTwoDigits(body.municipioCodigo);
    const distritoCodigo = cleanLastTwoDigits(body.distritoCodigo);

    if (!nit || !nrc || !nombre) {
      return json(
        { error: 'NIT, NRC y nombre del emisor son obligatorios.' },
        { status: 400 }
      );
    }

    const pool = getPostgresPool();

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
          clean(body.departamentoCodigo),
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

    const updated = await pool.query(
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
        clean(body.departamentoCodigo),
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

    return json({
      emitter: {
        ...updated.rows[0],
        rolEmisor: current.rolEmisor,
      },
    });
  } catch (error) {
    console.error('[api/profile/emisor] Error updating emitter', error);

    const message =
      error instanceof Error ? error.message : 'Error interno al guardar emisor';
    const status = message.includes('duplicate key') ? 409 : 500;

    return json({ error: message }, { status });
  }
}
