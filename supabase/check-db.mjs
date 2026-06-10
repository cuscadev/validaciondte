import pg from 'pg';
import { loadRepoEnv } from '../scripts/load-env.mjs';

loadRepoEnv();

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const tables = await client.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name like 'email_%'
  order by table_name
`);
console.log('email_* tables:', tables.rows.map((r) => r.table_name).join(', ') || '(none)');

const bucket = await client.query(`select id from storage.buckets where id = 'client-documents'`);
console.log('bucket client-documents:', bucket.rows.length ? 'ok' : 'missing');

await client.end();
