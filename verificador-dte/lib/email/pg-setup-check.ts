import { EMAIL_STORAGE_BUCKET } from '@/lib/supabase-admin';

type PgCheckResult = { ok: boolean; detail?: string };

function getPgConnectionString(): string | null {
  return process.env.SUPABASE_DB_URL?.trim() || null;
}

async function withPgClient<T>(fn: (query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>) => Promise<T>): Promise<T> {
  const connectionString = getPgConnectionString();
  if (!connectionString) {
    throw new Error('Sin SUPABASE_DB_URL para comprobar la base de datos.');
  }

  const pg = await import('pg');
  const client = new pg.default.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    return await fn((sql, params = []) => client.query(sql, params));
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function tableExistsViaPg(tableName: string): Promise<PgCheckResult> {
  try {
    const exists = await withPgClient(async (query) => {
      const result = await query(
        `select 1
         from information_schema.tables
         where table_schema = 'public' and table_name = $1
         limit 1`,
        [tableName]
      );
      return result.rows.length > 0;
    });

    return exists
      ? { ok: true }
      : {
          ok: false,
          detail: `Tabla public.${tableName} no existe. Ejecuta supabase/SETUP_FROM_ZERO.sql en el SQL Editor.`,
        };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'Error comprobando tabla via Postgres',
    };
  }
}

export async function columnExistsViaPg(
  tableName: string,
  columnName: string
): Promise<PgCheckResult> {
  try {
    const exists = await withPgClient(async (query) => {
      const result = await query(
        `select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = $1
           and column_name = $2
         limit 1`,
        [tableName, columnName]
      );
      return result.rows.length > 0;
    });

    return exists
      ? { ok: true }
      : {
          ok: false,
          detail: `Falta la columna public.${tableName}.${columnName}. Ejecuta supabase/migrations/004_email_json_content.sql.`,
        };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'Error comprobando columna via Postgres',
    };
  }
}

export async function storageBucketExistsViaPg(): Promise<PgCheckResult> {
  try {
    const exists = await withPgClient(async (query) => {
      const result = await query(
        `select 1 from storage.buckets where id = $1 limit 1`,
        [EMAIL_STORAGE_BUCKET]
      );
      return result.rows.length > 0;
    });

    return exists
      ? { ok: true }
      : {
          ok: false,
          detail: `Falta el bucket "${EMAIL_STORAGE_BUCKET}". Ejecuta supabase/SETUP_FROM_ZERO.sql en el SQL Editor.`,
        };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'Error comprobando storage via Postgres',
    };
  }
}
