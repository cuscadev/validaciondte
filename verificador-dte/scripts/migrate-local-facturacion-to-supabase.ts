/**
 * Migra datos transaccionales de facturación desde Postgres local (Docker)
 * hacia Supabase.
 *
 * Uso:
 *   pnpm exec tsx scripts/migrate-local-facturacion-to-supabase.ts --dry-run
 *   pnpm exec tsx scripts/migrate-local-facturacion-to-supabase.ts
 */

import pg from 'pg';

import { getFacturacionDatabaseUrl } from '../lib/facturacion-database-url';

const LOCAL_URL =
  process.env.LOCAL_DATABASE_URL ||
  'postgres://facturacion:facturacion123@localhost:5433/facturacion?sslmode=disable';

const dryRun = process.argv.includes('--dry-run');

type IdMap = Map<number, number>;

function nullIfZero(value: unknown) {
  const text = String(value ?? '').trim();
  return text === '' || text === '00' ? null : text;
}

async function fkExists(client: pg.PoolClient, table: string, codigo: string | null) {
  if (!codigo) return true;
  const result = await client.query(
    `SELECT 1 FROM ${table} WHERE codigo = $1 LIMIT 1`,
    [codigo],
  );
  return (result.rowCount ?? 0) > 0;
}

async function sanitizeLocationCodes(client: pg.PoolClient, row: Record<string, unknown>) {
  const departamento = nullIfZero(row.departamento_codigo) as string | null;
  const municipio = nullIfZero(row.municipio_codigo) as string | null;
  const distrito = nullIfZero(row.distrito_codigo) as string | null;

  return {
    departamento_codigo: departamento && (await fkExists(client, 'cat_005_departamentos', departamento))
      ? departamento
      : null,
    municipio_codigo: municipio && (await fkExists(client, 'cat_006_municipios', municipio))
      ? municipio
      : null,
    distrito_codigo: distrito && (await fkExists(client, 'cat_008_distritos', distrito))
      ? distrito
      : null,
  };
}

async function migrateUsuarios(
  local: pg.Pool,
  remote: pg.PoolClient,
  stats: Record<string, number>,
): Promise<IdMap> {
  const map: IdMap = new Map();
  const rows = await local.query('SELECT * FROM usuarios ORDER BY id');
  stats.usuarios = rows.rowCount ?? 0;

  for (const row of rows.rows) {
    if (dryRun) {
      map.set(row.id, row.id);
      continue;
    }

    const result = await remote.query(
      `
        INSERT INTO usuarios (firebase_uid, email, nombre, rol, activo, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (firebase_uid) DO UPDATE SET
          email = EXCLUDED.email,
          nombre = EXCLUDED.nombre,
          rol = EXCLUDED.rol,
          activo = EXCLUDED.activo,
          updated_at = EXCLUDED.updated_at
        RETURNING id
      `,
      [row.firebase_uid, row.email, row.nombre, row.rol, row.activo, row.created_at, row.updated_at],
    );

    map.set(row.id, result.rows[0].id as number);
  }

  return map;
}

async function migrateEmisores(
  local: pg.Pool,
  remote: pg.PoolClient,
  userMap: IdMap,
  stats: Record<string, number>,
): Promise<IdMap> {
  const map: IdMap = new Map();
  const rows = await local.query('SELECT * FROM emisores ORDER BY id');
  stats.emisores = rows.rowCount ?? 0;

  for (const row of rows.rows) {
    const location = await sanitizeLocationCodes(remote, row);
    const usuarioId = row.usuario_id ? userMap.get(row.usuario_id) ?? null : null;

    if (dryRun) {
      map.set(row.id, row.id);
      continue;
    }

    const result = await remote.query(
      `
        INSERT INTO emisores (
          nit, nrc, nombre, nombre_comercial, razon_social,
          tipo_establecimiento_codigo, codigo_actividad, descripcion_actividad,
          departamento_codigo, municipio_codigo, distrito_codigo, complemento_direccion,
          telefono, correo, regimen_tributario_codigo, tipo_afiliacion_codigo,
          certificado_path, certificado_password_hash, fecha_vencimiento_cert,
          usuario_id, activo, ambiente_codigo, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19,
          $20, $21, $22, $23, $24
        )
        ON CONFLICT (nit) DO UPDATE SET
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
          certificado_path = EXCLUDED.certificado_path,
          certificado_password_hash = EXCLUDED.certificado_password_hash,
          fecha_vencimiento_cert = EXCLUDED.fecha_vencimiento_cert,
          usuario_id = EXCLUDED.usuario_id,
          activo = EXCLUDED.activo,
          ambiente_codigo = EXCLUDED.ambiente_codigo,
          updated_at = EXCLUDED.updated_at
        RETURNING id
      `,
      [
        row.nit,
        row.nrc,
        row.nombre,
        row.nombre_comercial,
        row.razon_social,
        row.tipo_establecimiento_codigo,
        row.codigo_actividad,
        row.descripcion_actividad,
        location.departamento_codigo,
        location.municipio_codigo,
        location.distrito_codigo,
        row.complemento_direccion,
        row.telefono,
        row.correo,
        row.regimen_tributario_codigo,
        row.tipo_afiliacion_codigo,
        row.certificado_path,
        row.certificado_password_hash,
        row.fecha_vencimiento_cert,
        usuarioId,
        row.activo,
        row.ambiente_codigo,
        row.created_at,
        row.updated_at,
      ],
    );

    map.set(row.id, result.rows[0].id as number);
  }

  return map;
}

async function migrateClientes(
  local: pg.Pool,
  remote: pg.PoolClient,
  userMap: IdMap,
  emisorMap: IdMap,
  stats: Record<string, number>,
) {
  const rows = await local.query('SELECT * FROM clientes ORDER BY id');
  stats.clientes = rows.rowCount ?? 0;

  for (const row of rows.rows) {
    const location = await sanitizeLocationCodes(remote, row);
    const emisorId = row.emisor_id ? emisorMap.get(row.emisor_id) ?? null : null;
    const usuarioId = row.usuario_id ? userMap.get(row.usuario_id) ?? null : null;

    if (!emisorId) {
      console.warn(`[clientes] omitido id=${row.id}: emisor local ${row.emisor_id} sin mapeo`);
      continue;
    }

    if (dryRun) continue;

    await remote.query(
      `
        INSERT INTO clientes (
          tipo_documento_codigo, numero_documento, nombre, nombre_comercial, razon_social,
          telefono, correo, departamento_codigo, municipio_codigo, distrito_codigo,
          complemento_direccion, nrc, codigo_actividad, regimen_tributario_codigo,
          tipo_cliente, es_consumidor_final, pais_codigo, cod_domiciliado,
          emisor_id, usuario_id, uso_preferente, activo, datos_completados,
          created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18,
          $19, $20, $21, $22, $23,
          $24, $25
        )
        ON CONFLICT (numero_documento, emisor_id) DO UPDATE SET
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
          usuario_id = EXCLUDED.usuario_id,
          uso_preferente = EXCLUDED.uso_preferente,
          activo = EXCLUDED.activo,
          datos_completados = EXCLUDED.datos_completados,
          updated_at = EXCLUDED.updated_at
      `,
      [
        row.tipo_documento_codigo,
        row.numero_documento,
        row.nombre,
        row.nombre_comercial,
        row.razon_social,
        row.telefono,
        row.correo,
        location.departamento_codigo,
        location.municipio_codigo,
        location.distrito_codigo,
        row.complemento_direccion,
        row.nrc,
        row.codigo_actividad,
        row.regimen_tributario_codigo,
        row.tipo_cliente,
        row.es_consumidor_final,
        row.pais_codigo,
        row.cod_domiciliado,
        emisorId,
        usuarioId,
        row.uso_preferente,
        row.activo,
        row.datos_completados,
        row.created_at,
        row.updated_at,
      ],
    );
  }
}

async function migrateUsuarioEmisor(
  local: pg.Pool,
  remote: pg.PoolClient,
  userMap: IdMap,
  emisorMap: IdMap,
  stats: Record<string, number>,
) {
  const rows = await local.query('SELECT * FROM usuario_emisor ORDER BY id');
  stats.usuario_emisor = rows.rowCount ?? 0;

  for (const row of rows.rows) {
    const usuarioId = userMap.get(row.usuario_id);
    const emisorId = emisorMap.get(row.emisor_id);
    if (!usuarioId || !emisorId) {
      console.warn(
        `[usuario_emisor] omitido id=${row.id}: usuario=${row.usuario_id} emisor=${row.emisor_id}`,
      );
      continue;
    }

    if (dryRun) continue;

    await remote.query(
      `
        INSERT INTO usuario_emisor (usuario_id, emisor_id, rol, fecha_asignacion)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (usuario_id, emisor_id) DO UPDATE SET
          rol = EXCLUDED.rol,
          fecha_asignacion = EXCLUDED.fecha_asignacion
      `,
      [usuarioId, emisorId, row.rol, row.fecha_asignacion],
    );
  }
}

async function migrateEmisorConfiguracion(
  local: pg.Pool,
  remote: pg.PoolClient,
  emisorMap: IdMap,
  stats: Record<string, number>,
) {
  const rows = await local.query('SELECT * FROM emisor_configuracion ORDER BY id');
  stats.emisor_configuracion = rows.rowCount ?? 0;

  for (const row of rows.rows) {
    const emisorId = emisorMap.get(row.emisor_id);
    if (!emisorId) continue;
    if (dryRun) continue;

    await remote.query(
      `
        INSERT INTO emisor_configuracion (
          emisor_id, metodo_pago_defecto, forma_pago_defecto, plazo_credito_defecto,
          tipo_venta_defecto, moneda_defecto, tasa_iva, generador_codigo,
          prefijo_correlativo, tipo_retencion_defecto, activo, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (emisor_id) DO UPDATE SET
          metodo_pago_defecto = EXCLUDED.metodo_pago_defecto,
          forma_pago_defecto = EXCLUDED.forma_pago_defecto,
          plazo_credito_defecto = EXCLUDED.plazo_credito_defecto,
          tipo_venta_defecto = EXCLUDED.tipo_venta_defecto,
          moneda_defecto = EXCLUDED.moneda_defecto,
          tasa_iva = EXCLUDED.tasa_iva,
          generador_codigo = EXCLUDED.generador_codigo,
          prefijo_correlativo = EXCLUDED.prefijo_correlativo,
          tipo_retencion_defecto = EXCLUDED.tipo_retencion_defecto,
          activo = EXCLUDED.activo,
          updated_at = EXCLUDED.updated_at
      `,
      [
        emisorId,
        row.metodo_pago_defecto,
        row.forma_pago_defecto,
        row.plazo_credito_defecto,
        row.tipo_venta_defecto,
        row.moneda_defecto,
        row.tasa_iva,
        row.generador_codigo,
        row.prefijo_correlativo,
        row.tipo_retencion_defecto,
        row.activo,
        row.created_at,
        row.updated_at,
      ],
    );
  }
}

async function main() {
  const local = new pg.Pool({ connectionString: LOCAL_URL });
  const remote = new pg.Pool({ connectionString: getFacturacionDatabaseUrl() });
  const client = await remote.connect();

  const stats: Record<string, number> = {};

  try {
    if (!dryRun) await client.query('BEGIN');

    const userMap = await migrateUsuarios(local, client, stats);
    const emisorMap = await migrateEmisores(local, client, userMap, stats);
    await migrateClientes(local, client, userMap, emisorMap, stats);
    await migrateUsuarioEmisor(local, client, userMap, emisorMap, stats);
    await migrateEmisorConfiguracion(local, client, emisorMap, stats);

    if (!dryRun) await client.query('COMMIT');

    console.log(dryRun ? 'DRY RUN — filas a migrar:' : 'Migración completada:');
    for (const [table, count] of Object.entries(stats)) {
      console.log(`  ${table}: ${count}`);
    }
  } catch (error) {
    if (!dryRun) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await local.end();
    await remote.end();
  }
}

main().catch((error) => {
  console.error('Error en migración:', error);
  process.exit(1);
});
