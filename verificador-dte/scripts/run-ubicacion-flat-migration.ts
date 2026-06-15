/**
 * Solo migracion de catalogos de ubicacion (CAT-012/013/008).
 * Uso: npx tsx scripts/run-ubicacion-flat-migration.ts
 */
import fs from 'fs';
import path from 'path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const repoRoot = path.resolve(__dirname, '../..');

loadEnv({ path: path.join(repoRoot, 'go-dte-api', '.env') });
loadEnv({ path: path.join(repoRoot, 'verificador-dte', '.env.local') });
loadEnv({ path: path.join(repoRoot, 'verificador-dte', '.env') });

function readDatabaseUrl() {
  return (
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.FACTURACION_DATABASE_URL?.trim() ||
    ''
  );
}

async function main() {
  const databaseUrl = readDatabaseUrl();
  if (!databaseUrl) {
    console.error('SUPABASE_DB_URL, DATABASE_URL o FACTURACION_DATABASE_URL requerido.');
    process.exit(1);
  }

  const sqlPath = path.join(repoRoot, 'scripts', 'fix-ubicacion-flat.sql');
  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    console.log('Ejecutando fix-ubicacion-flat.sql...');
    await pool.query(fs.readFileSync(sqlPath, 'utf8'));

    const counts = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM cat_012_departamento) AS departamentos,
        (SELECT count(*)::int FROM cat_013_municipio) AS municipios,
        (SELECT count(*)::int FROM cat_008_distrito) AS distritos
    `);
    console.log('Catalogos nuevos:', counts.rows[0]);

    const legacy = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('cat_005_departamentos', 'cat_006_municipios', 'cat_008_distritos')
    `);
    console.log('Tablas viejas restantes:', legacy.rows);

    const verifyPath = path.join(repoRoot, 'scripts', 'verify-ubicacion-emisores.sql');
    if (fs.existsSync(verifyPath)) {
      const result = await pool.query(fs.readFileSync(verifyPath, 'utf8'));
      console.log('Registros con ubicacion invalida:', result.rowCount);
      if (result.rowCount) {
        console.table(result.rows.slice(0, 20));
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
