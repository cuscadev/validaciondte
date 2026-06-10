/**
 * Migra documentos legacy: descarga JSON del bucket client-documents
 * y lo guarda en email_documents.json_content (JSONB), limpiando storage_path.
 *
 * Uso (desde la raiz del repo):
 *   node scripts/backfill-email-json-to-db.mjs
 *   node scripts/backfill-email-json-to-db.mjs --dry-run
 */
import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadRepoEnv } from './load-env.mjs';

const require = createRequire(import.meta.url);
const pg = require(resolve(dirname(fileURLToPath(import.meta.url)), '../supabase/node_modules/pg'));

loadRepoEnv();

const dryRun = process.argv.includes('--dry-run');
const dbUrl = process.env.SUPABASE_DB_URL?.trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const bucket = 'client-documents';

if (!dbUrl || dbUrl.includes('[YOUR-PASSWORD]')) {
  console.error('Falta SUPABASE_DB_URL en .env.local (raiz del repo).');
  process.exit(1);
}
if (!supabaseUrl || !serviceKey) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.'
  );
  process.exit(1);
}

async function downloadJson(storagePath) {
  const objectPath = storagePath.split('/').map(encodeURIComponent).join('/');
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  });
  if (!res.ok) {
    throw new Error(`download ${storagePath}: HTTP ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  JSON.parse(text);
  return text;
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

let ok = 0;
let errors = 0;
let skipped = 0;

try {
  await client.connect();

  const { rows } = await client.query(`
    SELECT id, organization_id, storage_path, file_name
    FROM public.email_documents
    WHERE import_status = 'imported'
      AND storage_path IS NOT NULL
      AND btrim(storage_path) <> ''
      AND json_content IS NULL
    ORDER BY created_at ASC
  `);

  console.log(
    dryRun ? `[dry-run] ${rows.length} filas legacy a migrar` : `${rows.length} filas legacy a migrar`
  );

  for (const row of rows) {
    const label = `${row.id} (${row.file_name || row.storage_path})`;
    try {
      const jsonText = await downloadJson(row.storage_path);
      if (dryRun) {
        console.log(`  [dry-run] OK ${label}`);
        ok++;
        continue;
      }
      await client.query(
        `
        UPDATE public.email_documents
        SET json_content = $1::jsonb,
            storage_path = NULL
        WHERE id = $2
          AND organization_id = $3
        `,
        [jsonText, row.id, row.organization_id]
      );
      console.log(`  OK ${label}`);
      ok++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/JSON|Unexpected token|invalid/i.test(message)) {
        console.warn(`  SKIP (JSON invalido) ${label}: ${message}`);
        skipped++;
      } else {
        console.error(`  ERROR ${label}: ${message}`);
        errors++;
      }
    }
  }

  console.log('\nResumen:', { ok, skipped, errors, total: rows.length });
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
