import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getPostgresPool } from '@/lib/postgres';

export const runtime = 'nodejs';

type ReceptorInput = {
  id?: number;
  tipoDocumentoCodigo?: string;
  numeroDocumento?: string;
  nombre?: string;
  nombreComercial?: string;
  razonSocial?: string;
  telefono?: string;
  correo?: string;
  departamentoCodigo?: string;
  municipioCodigo?: string;
  distritoCodigo?: string;
  complementoDireccion?: string;
  nrc?: string;
  codigoActividad?: string;
  regimenTributarioCodigo?: string;
  tipoCliente?: string;
  esConsumidorFinal?: boolean;
  paisCodigo?: string;
  codDomiciliado?: number;
  usoPreferente?: string;
  datosCompletados?: boolean;
  activo?: boolean;
};

function clean(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function required(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
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

async function getCurrentEmitter(uid: string, email: string) {
  const result = await getPostgresPool().query(
    `
      SELECT e.id, ue.rol AS rol_emisor
      FROM usuarios u
      INNER JOIN usuario_emisor ue ON ue.usuario_id = u.id
      INNER JOIN emisores e ON e.id = ue.emisor_id
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

function canWrite(role: string, emitterRole: string) {
  if (role === 'superadmin') return true;
  return emitterRole === 'propietario' || emitterRole === 'editor';
}

function mapReceptor(row: Record<string, unknown>) {
  return {
    id: row.id,
    tipoDocumentoCodigo: row.tipo_documento_codigo,
    tipoDocumentoNombre: row.tipo_documento_nombre,
    numeroDocumento: row.numero_documento,
    nombre: row.nombre,
    nombreComercial: row.nombre_comercial,
    razonSocial: row.razon_social,
    telefono: row.telefono,
    correo: row.correo,
    departamentoCodigo: row.departamento_codigo,
    departamentoNombre: row.departamento_nombre,
    municipioCodigo: row.municipio_codigo,
    municipioNombre: row.municipio_nombre,
    distritoCodigo: row.distrito_codigo,
    complementoDireccion: row.complemento_direccion,
    nrc: row.nrc,
    codigoActividad: row.codigo_actividad,
    actividadNombre: row.actividad_nombre,
    regimenTributarioCodigo: row.regimen_tributario_codigo,
    tipoCliente: row.tipo_cliente,
    esConsumidorFinal: row.es_consumidor_final,
    paisCodigo: row.pais_codigo,
    paisNombre: row.pais_nombre,
    codDomiciliado: row.cod_domiciliado,
    usoPreferente: row.uso_preferente,
    activo: row.activo,
    datosCompletados: row.datos_completados,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listReceptors(emisorId: number, search: string) {
  const normalized = `%${search.trim()}%`;
  const result = await getPostgresPool().query(
    `
      SELECT
        c.*,
        td.nombre AS tipo_documento_nombre,
        d.nombre AS departamento_nombre,
        m.nombre AS municipio_nombre,
        a.nombre AS actividad_nombre,
        p.nombre AS pais_nombre
      FROM clientes c
      LEFT JOIN cat_003_tipo_documento td ON td.codigo = c.tipo_documento_codigo
      LEFT JOIN cat_005_departamentos d ON d.codigo = c.departamento_codigo
      LEFT JOIN cat_006_municipios m ON m.codigo = c.municipio_codigo
      LEFT JOIN cat_024_codigo_actividad a ON a.codigo = c.codigo_actividad
      LEFT JOIN cat_paises p ON p.codigo = c.pais_codigo
      WHERE c.emisor_id = $1
        AND (
          $2 = '%%'
          OR c.numero_documento ILIKE $2
          OR c.nombre ILIKE $2
          OR COALESCE(c.nrc, '') ILIKE $2
          OR COALESCE(c.correo, '') ILIKE $2
        )
      ORDER BY c.updated_at DESC, c.id DESC
      LIMIT 300
    `,
    [emisorId, normalized]
  );

  return result.rows.map(mapReceptor);
}

export async function GET(req: NextRequest) {
  try {
    const identity = await getIdentity(req);
    if (!identity) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const emitter = await getCurrentEmitter(identity.uid, identity.email);
    if (!emitter) {
      return NextResponse.json({ error: 'No hay emisor vinculado.' }, { status: 404 });
    }

    const search = new URL(req.url).searchParams.get('q') || '';
    const receptors = await listReceptors(Number(emitter.id), search);

    return NextResponse.json({ receptors });
  } catch (error) {
    console.error('[api/facturacion/receptors] Error listing receptors', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await getIdentity(req);
    if (!identity) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const emitter = await getCurrentEmitter(identity.uid, identity.email);
    if (!emitter) {
      return NextResponse.json({ error: 'No hay emisor vinculado.' }, { status: 404 });
    }
    if (!canWrite(identity.role, String(emitter.rol_emisor || ''))) {
      return NextResponse.json({ error: 'No tienes permiso para guardar receptores.' }, { status: 403 });
    }

    const body = (await req.json()) as ReceptorInput;
    const tipoDocumento = required(body.tipoDocumentoCodigo);
    const numeroDocumento = required(body.numeroDocumento);
    const nombre = required(body.nombre);

    if (!tipoDocumento || !numeroDocumento || !nombre) {
      return NextResponse.json(
        { error: 'Tipo de documento, numero de documento y nombre son obligatorios.' },
        { status: 400 }
      );
    }

    const datosCompletados = Boolean(
      body.datosCompletados ??
        (body.correo && body.telefono && body.complementoDireccion)
    );

    if (body.id) {
      const update = await getPostgresPool().query(
        `
          UPDATE clientes
          SET
            tipo_documento_codigo = $1,
            numero_documento = $2,
            nombre = $3,
            nombre_comercial = $4,
            razon_social = $5,
            telefono = $6,
            correo = $7,
            departamento_codigo = $8,
            municipio_codigo = $9,
            distrito_codigo = $10,
            complemento_direccion = $11,
            nrc = $12,
            codigo_actividad = $13,
            regimen_tributario_codigo = $14,
            tipo_cliente = $15,
            es_consumidor_final = $16,
            pais_codigo = $17,
            cod_domiciliado = $18,
            uso_preferente = $19,
            datos_completados = $20,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $21
            AND emisor_id = $22
          RETURNING id
        `,
        [
          tipoDocumento,
          numeroDocumento,
          nombre,
          clean(body.nombreComercial),
          clean(body.razonSocial),
          clean(body.telefono),
          clean(body.correo),
          clean(body.departamentoCodigo),
          clean(body.municipioCodigo),
          clean(body.distritoCodigo),
          clean(body.complementoDireccion),
          clean(body.nrc),
          clean(body.codigoActividad),
          clean(body.regimenTributarioCodigo),
          clean(body.tipoCliente) || 'persona_natural',
          Boolean(body.esConsumidorFinal),
          clean(body.paisCodigo),
          Number(body.codDomiciliado || 0),
          clean(body.usoPreferente) || 'facturacion',
          datosCompletados,
          Number(body.id),
          Number(emitter.id),
        ]
      );

      if (update.rowCount === 0) {
        return NextResponse.json(
          { error: 'Receptor no encontrado para este emisor.' },
          { status: 404 }
        );
      }

      return NextResponse.json({ id: update.rows[0]?.id, success: true });
    }

    const result = await getPostgresPool().query(
      `
        INSERT INTO clientes (
          tipo_documento_codigo,
          numero_documento,
          nombre,
          nombre_comercial,
          razon_social,
          telefono,
          correo,
          departamento_codigo,
          municipio_codigo,
          distrito_codigo,
          complemento_direccion,
          nrc,
          codigo_actividad,
          regimen_tributario_codigo,
          tipo_cliente,
          es_consumidor_final,
          pais_codigo,
          cod_domiciliado,
          emisor_id,
          uso_preferente,
          activo,
          datos_completados
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, TRUE, $21
        )
        ON CONFLICT (numero_documento, emisor_id)
        DO UPDATE SET
          tipo_documento_codigo = EXCLUDED.tipo_documento_codigo,
          nombre = EXCLUDED.nombre,
          nombre_comercial = EXCLUDED.nombre_comercial,
          razon_social = EXCLUDED.razon_social,
          telefono = EXCLUDED.telefono,
          correo = EXCLUDED.correo,
          departamento_codigo = EXCLUDED.departamento_codigo,
          municipio_codigo = EXCLUDED.municipio_codigo,
          distrito_codigo = EXCLUDED.distrito_codigo,
          complemento_direccion = EXCLUDED.complemento_direccion,
          nrc = EXCLUDED.nrc,
          codigo_actividad = EXCLUDED.codigo_actividad,
          regimen_tributario_codigo = EXCLUDED.regimen_tributario_codigo,
          tipo_cliente = EXCLUDED.tipo_cliente,
          es_consumidor_final = EXCLUDED.es_consumidor_final,
          pais_codigo = EXCLUDED.pais_codigo,
          cod_domiciliado = EXCLUDED.cod_domiciliado,
          uso_preferente = EXCLUDED.uso_preferente,
          datos_completados = EXCLUDED.datos_completados,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `,
      [
        tipoDocumento,
        numeroDocumento,
        nombre,
        clean(body.nombreComercial),
        clean(body.razonSocial),
        clean(body.telefono),
        clean(body.correo),
        clean(body.departamentoCodigo),
        clean(body.municipioCodigo),
        clean(body.distritoCodigo),
        clean(body.complementoDireccion),
        clean(body.nrc),
        clean(body.codigoActividad),
        clean(body.regimenTributarioCodigo),
        clean(body.tipoCliente) || 'persona_natural',
        Boolean(body.esConsumidorFinal),
        clean(body.paisCodigo),
        Number(body.codDomiciliado || 0),
        Number(emitter.id),
        clean(body.usoPreferente) || 'facturacion',
        datosCompletados,
      ]
    );

    return NextResponse.json({ id: result.rows[0]?.id, success: true });
  } catch (error) {
    console.error('[api/facturacion/receptors] Error saving receptor', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
