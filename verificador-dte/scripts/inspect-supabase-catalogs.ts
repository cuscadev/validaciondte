import { config as loadEnv } from 'dotenv';
import path from 'path';
import pg from 'pg';

const repoRoot = path.resolve(__dirname, '../..');
loadEnv({ path: path.join(repoRoot, 'go-dte-api', '.env') });
loadEnv({ path: path.join(repoRoot, 'verificador-dte', '.env.local') });

const url =
  process.env.SUPABASE_DB_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  '';

if (!url) {
  console.error('No SUPABASE_DB_URL');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

async function main() {
  const host = new URL(url.replace(/^postgres(ql)?:\/\//, 'http://')).host;
  console.log('DB host:', host);

  const tables = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (
        table_name LIKE 'cat_012%'
        OR table_name LIKE 'cat_013%'
        OR table_name LIKE 'cat_008%'
      )
    ORDER BY table_name
  `);
  console.log('\nTablas ubicacion:');
  for (const row of tables.rows) {
    console.log(' -', row.table_name);
  }

  for (const table of tables.rows.map((r) => r.table_name)) {
    const cols = await pool.query(
      `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `,
      [table]
    );
    console.log(`\n${table}:`);
    console.log(cols.rows.map((c) => c.column_name).join(', '));
    const count = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
    console.log('rows:', count.rows[0].n);
  }
}

main()
  .catch(console.error)
  .finally(() => pool.end());
