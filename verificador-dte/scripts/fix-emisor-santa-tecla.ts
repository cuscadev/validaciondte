import fs from 'fs';
import path from 'path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const repoRoot = path.resolve(__dirname, '../..');

loadEnv({ path: path.join(repoRoot, 'go-dte-api', '.env') });
loadEnv({ path: path.join(repoRoot, 'verificador-dte', '.env.local') });
loadEnv({ path: path.join(repoRoot, 'verificador-dte', '.env') });

async function main() {
  const databaseUrl =
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.FACTURACION_DATABASE_URL?.trim() ||
    '';
  if (!databaseUrl) {
    console.error('SUPABASE_DB_URL, DATABASE_URL o FACTURACION_DATABASE_URL requerido.');
    process.exit(1);
  }

  const sqlPath = path.join(repoRoot, 'scripts', 'fix-emisor-santa-tecla.sql');
  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query(fs.readFileSync(sqlPath, 'utf8'));
    console.log('Updated rows:', result.rowCount);

    const check = await pool.query(`
      SELECT id, nit, departamento_codigo, municipio_codigo, distrito_codigo, complemento_direccion
      FROM emisores
      WHERE id = 1
    `);
    console.table(check.rows);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
