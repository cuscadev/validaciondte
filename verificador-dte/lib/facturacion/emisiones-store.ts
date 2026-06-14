import { randomUUID } from 'node:crypto';

import type { Pool, PoolClient } from 'pg';

import { getPostgresPool } from '@/lib/postgres';

export type TipoDteEmision = '01' | '03' | '05' | '06' | '11' | '14';

export type EmisionPayload = Record<string, unknown>;

export type EmisionRow = {
  id: string;
  tipo_dte: TipoDteEmision;
  firebase_uid: string;
  emisor_id: number | null;
  receptor_id: number | null;
  codigo_generacion: string | null;
  numero_control: string | null;
  status: string;
  environment: string;
  source: string | null;
  total_pagar: number | null;
  sello_recepcion: string | null;
  related_emision_id: string | null;
  error_message: string | null;
  payload: EmisionPayload;
  created_at: Date;
  updated_at: Date;
};

const TABLE_BY_TIPO: Record<TipoDteEmision, string> = {
  '01': 'dte_emisiones_01_consumidor_final',
  '03': 'dte_emisiones_03_credito_fiscal',
  '05': 'dte_emisiones_05_nota_credito',
  '06': 'dte_emisiones_06_nota_debito',
  '11': 'dte_emisiones_11_exportacion',
  '14': 'dte_emisiones_14_sujeto_excluido',
};

function asString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asTipoDte(value: unknown): TipoDteEmision | null {
  const tipo = asString(value);
  return tipo in TABLE_BY_TIPO ? (tipo as TipoDteEmision) : null;
}

function tableForTipo(tipoDte: TipoDteEmision) {
  return TABLE_BY_TIPO[tipoDte];
}

function serializePayload(value: EmisionPayload) {
  return JSON.parse(JSON.stringify(value)) as EmisionPayload;
}

function extractScalars(partial: EmisionPayload) {
  return {
    codigo_generacion: asString(partial.codigoGeneracion) || null,
    numero_control: asString(partial.numeroControl) || null,
    status: asString(partial.status) || 'started',
    environment: asString(partial.environment) || 'test',
    source: asString(partial.source) || null,
    total_pagar: asNumber(partial.totalPagar),
    sello_recepcion:
      asString(partial.selloRecepcion) ||
      asString(partial.selloRecibido) ||
      null,
    error_message: asString(partial.error) || null,
    receptor_id: asNumber(partial.receptorId),
    related_emision_id: asString(partial.relatedEmisionId || partial.relatedId) || null,
  };
}

/** Formato compatible con rutas/PDF que leían Firestore. */
export function rowToEmisionData(row: EmisionRow): EmisionPayload {
  const payload = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as EmisionPayload;
  return {
    ...payload,
    uid: row.firebase_uid,
    tipoDte: row.tipo_dte,
    status: row.status,
    environment: row.environment,
    source: row.source ?? '',
    codigoGeneracion: row.codigo_generacion ?? '',
    numeroControl: row.numero_control ?? '',
    totalPagar: row.total_pagar ?? 0,
    selloRecepcion: row.sello_recepcion ?? '',
    selloRecibido: row.sello_recepcion ?? '',
    receptorId: row.receptor_id,
    relatedEmisionId: row.related_emision_id,
    error: row.error_message ?? '',
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapRow(row: Record<string, unknown>): EmisionRow {
  return {
    id: asString(row.id),
    tipo_dte: asString(row.tipo_dte) as TipoDteEmision,
    firebase_uid: asString(row.firebase_uid),
    emisor_id: row.emisor_id == null ? null : Number(row.emisor_id),
    receptor_id: row.receptor_id == null ? null : Number(row.receptor_id),
    codigo_generacion: row.codigo_generacion == null ? null : asString(row.codigo_generacion),
    numero_control: row.numero_control == null ? null : asString(row.numero_control),
    status: asString(row.status),
    environment: asString(row.environment),
    source: row.source == null ? null : asString(row.source),
    total_pagar: row.total_pagar == null ? null : Number(row.total_pagar),
    sello_recepcion: row.sello_recepcion == null ? null : asString(row.sello_recepcion),
    related_emision_id:
      row.related_emision_id == null ? null : asString(row.related_emision_id),
    error_message: row.error_message == null ? null : asString(row.error_message),
    payload:
      row.payload && typeof row.payload === 'object'
        ? (row.payload as EmisionPayload)
        : {},
    created_at: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
    updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at)),
  };
}

async function resolveTipoDte(client: Pool | PoolClient, id: string): Promise<TipoDteEmision | null> {
  const result = await client.query<{ tipo_dte: string }>(
    'SELECT tipo_dte FROM dte_emisiones_routing WHERE id = $1',
    [id],
  );
  return asTipoDte(result.rows[0]?.tipo_dte);
}

export async function createEmision(
  tipoDte: TipoDteEmision,
  data: EmisionPayload,
  options?: { emisorId?: number | null; id?: string },
): Promise<string> {
  const pool = getPostgresPool();
  const client = await pool.connect();
  const id = options?.id || randomUUID();
  const payload = serializePayload(data);
  const scalars = extractScalars(payload);
  const firebaseUid = asString(data.uid);
  const table = tableForTipo(tipoDte);

  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO dte_emisiones_routing (id, tipo_dte) VALUES ($1, $2)', [
      id,
      tipoDte,
    ]);

    const hasRelated = tipoDte === '05' || tipoDte === '06';
    if (hasRelated) {
      await client.query(
        `
          INSERT INTO ${table} (
            id, firebase_uid, emisor_id, receptor_id, codigo_generacion, numero_control,
            status, environment, source, total_pagar, sello_recepcion, related_emision_id,
            error_message, payload
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        `,
        [
          id,
          firebaseUid,
          options?.emisorId ?? null,
          scalars.receptor_id,
          scalars.codigo_generacion,
          scalars.numero_control,
          scalars.status,
          scalars.environment,
          scalars.source,
          scalars.total_pagar,
          scalars.sello_recepcion,
          scalars.related_emision_id,
          scalars.error_message,
          payload,
        ],
      );
    } else {
      await client.query(
        `
          INSERT INTO ${table} (
            id, firebase_uid, emisor_id, receptor_id, codigo_generacion, numero_control,
            status, environment, source, total_pagar, sello_recepcion, error_message, payload
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        `,
        [
          id,
          firebaseUid,
          options?.emisorId ?? null,
          scalars.receptor_id,
          scalars.codigo_generacion,
          scalars.numero_control,
          scalars.status,
          scalars.environment,
          scalars.source,
          scalars.total_pagar,
          scalars.sello_recepcion,
          scalars.error_message,
          payload,
        ],
      );
    }

    await client.query('COMMIT');
    return id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function mergeEmision(id: string, partial: EmisionPayload): Promise<void> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const tipoDte = await resolveTipoDte(client, id);
    if (!tipoDte) throw new Error('Emision no encontrada');

    const table = tableForTipo(tipoDte);
    const current = await client.query(`SELECT payload FROM ${table} WHERE id = $1`, [id]);
    if (!current.rowCount) throw new Error('Emision no encontrada');

    const merged = {
      ...(current.rows[0].payload as EmisionPayload),
      ...serializePayload(partial),
    };
    const scalars = extractScalars(merged);
    const hasRelated = tipoDte === '05' || tipoDte === '06';

    if (hasRelated) {
      await client.query(
        `
          UPDATE ${table}
          SET payload = $1,
              codigo_generacion = $2,
              numero_control = $3,
              status = $4,
              environment = $5,
              source = $6,
              total_pagar = $7,
              sello_recepcion = $8,
              error_message = $9,
              receptor_id = $10,
              related_emision_id = $11,
              updated_at = now()
          WHERE id = $12
        `,
        [
          merged,
          scalars.codigo_generacion,
          scalars.numero_control,
          scalars.status,
          scalars.environment,
          scalars.source,
          scalars.total_pagar,
          scalars.sello_recepcion,
          scalars.error_message,
          scalars.receptor_id,
          scalars.related_emision_id,
          id,
        ],
      );
    } else {
      await client.query(
        `
          UPDATE ${table}
          SET payload = $1,
              codigo_generacion = $2,
              numero_control = $3,
              status = $4,
              environment = $5,
              source = $6,
              total_pagar = $7,
              sello_recepcion = $8,
              error_message = $9,
              receptor_id = $10,
              updated_at = now()
          WHERE id = $11
        `,
        [
          merged,
          scalars.codigo_generacion,
          scalars.numero_control,
          scalars.status,
          scalars.environment,
          scalars.source,
          scalars.total_pagar,
          scalars.sello_recepcion,
          scalars.error_message,
          scalars.receptor_id,
          id,
        ],
      );
    }
  } finally {
    client.release();
  }
}

export async function getEmisionById(id: string): Promise<EmisionRow | null> {
  const pool = getPostgresPool();
  const tipoDte = await resolveTipoDte(pool, id);
  if (!tipoDte) return null;

  const table = tableForTipo(tipoDte);
  const result = await pool.query(
    `SELECT *, $1::varchar AS tipo_dte FROM ${table} WHERE id = $2`,
    [tipoDte, id],
  );
  if (!result.rowCount) return null;
  return mapRow(result.rows[0]);
}

export async function getEmisionDataById(id: string): Promise<EmisionPayload | null> {
  const row = await getEmisionById(id);
  return row ? rowToEmisionData(row) : null;
}

export type ListEmisionesOptions = {
  firebaseUid?: string;
  tipoDte?: TipoDteEmision;
  limit?: number;
  superadmin?: boolean;
};

export async function listEmisiones(options: ListEmisionesOptions) {
  const limit = Math.max(1, Math.min(100, options.limit ?? 50));
  const pool = getPostgresPool();
  const params: unknown[] = [];
  const where: string[] = [];

  if (!options.superadmin && options.firebaseUid) {
    params.push(options.firebaseUid);
    where.push(`firebase_uid = $${params.length}`);
  }

  if (options.tipoDte) {
    params.push(options.tipoDte);
    where.push(`tipo_dte = $${params.length}`);
  }

  params.push(limit);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT *
      FROM v_dte_emisiones
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${params.length}
    `,
    params,
  );

  return result.rows.map((row) => mapRow(row));
}

export type EmisionDataRecord = EmisionPayload & { id: string };

export async function listEmisionData(options: ListEmisionesOptions): Promise<EmisionDataRecord[]> {
  const rows = await listEmisiones(options);
  return rows.map((row): EmisionDataRecord => ({
    id: row.id,
    ...rowToEmisionData(row),
  }));
}

export async function assertEmisionAccess(
  id: string,
  uid: string,
  role: string,
): Promise<EmisionPayload> {
  const row = await getEmisionById(id);
  if (!row) throw new Error('Emision no encontrada');
  if (role !== 'superadmin' && row.firebase_uid !== uid) {
    throw new Error('No autorizado');
  }
  return rowToEmisionData(row);
}
