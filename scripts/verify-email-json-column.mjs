import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadRepoEnv } from './load-env.mjs';

const require = createRequire(import.meta.url);
const pg = require(resolve(dirname(fileURLToPath(import.meta.url)), '../supabase/node_modules/pg'));

loadRepoEnv();

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const col = await client.query(`
  SELECT column_name, data_type, udt_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'email_documents'
    AND column_name = 'json_content'
`);

console.log('Columna json_content:', col.rows[0]);

const rows = await client.query(`
  SELECT id,
         import_status,
         storage_path IS NOT NULL AS en_bucket,
         json_content IS NOT NULL AS en_bd,
         pg_typeof(json_content) AS tipo
  FROM email_documents
  ORDER BY created_at DESC
  LIMIT 5
`);

console.log('Ultimas filas:', JSON.stringify(rows.rows, null, 2));
await client.end();
