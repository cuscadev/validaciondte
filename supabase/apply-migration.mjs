/**
 * Aplica migraciones SQL al proyecto Supabase.
 *
 * Uso (desde la raíz del repo):
 *   set SUPABASE_DB_URL=postgresql://postgres:TU_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
 *   node supabase/apply-migration.mjs
 *
 * Solo una migracion:
 *   set MIGRATION=002
 *   node supabase/apply-migration.mjs
 */
import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { loadRepoEnv } from '../scripts/load-env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

loadRepoEnv();

const dbUrl = process.env.SUPABASE_DB_URL?.trim();
if (!dbUrl || dbUrl.includes('[YOUR-PASSWORD]')) {
  console.error(
    'Falta SUPABASE_DB_URL con la contraseña real de Postgres.\n' +
      'Supabase Dashboard > Project Settings > Database > Connection string (URI).\n' +
      'Agregala en .env.local (raiz del repo)'
  );
  process.exit(1);
}

const only = process.env.MIGRATION?.trim();
const migrationsDir = resolve(__dirname, 'migrations');
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const selected = only
  ? files.filter((name) => name.startsWith(`${only}_`) || name === `${only}.sql`)
  : files;

if (!selected.length) {
  console.error('No hay migraciones que coincidan con MIGRATION=', only || '(todas)');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  for (const file of selected) {
    const sqlPath = resolve(migrationsDir, file);
    const sql = readFileSync(sqlPath, 'utf8');
    console.log(`Ejecutando ${file}...`);
    await client.query(sql);
    console.log(`  OK: ${file}`);
  }
  console.log('Migraciones aplicadas correctamente.');

  const tables = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'email_connections',
        'email_sync_jobs',
        'email_documents',
        'email_document_links',
        'email_sync_job_results'
      )
    order by table_name
  `);
  console.log('Tablas:', tables.rows.map((r) => r.table_name).join(', ') || '(ninguna)');

  const bucket = await client.query(`
    select id from storage.buckets where id = 'client-documents'
  `);
  console.log('Bucket client-documents:', bucket.rows.length ? 'ok' : 'falta');
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
