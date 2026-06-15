/**
 * Ejecuta scripts SQL de Fase 1 (catálogos ubicación, CAT-013, distritos, correlativos).
 * Uso: npx tsx scripts/run-fase1-catalog-migrations.ts
 */
import fs from 'fs';
import path from 'path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const repoRoot = path.resolve(__dirname, '../..');

loadEnv({ path: path.join(repoRoot, 'go-dte-api', '.env') });
loadEnv({ path: path.join(repoRoot, 'verificador-dte', '.env.local') });
loadEnv({ path: path.join(repoRoot, 'verificador-dte', '.env') });

const SCRIPTS = [
  'scripts/fix-ubicacion-flat.sql',
  'scripts/fix-cat-013-tipo-dte.sql',
  'scripts/fix-emisor-config-correlativos.sql',
  'go-dte-api/db/dte-sequences-schema.sql',
];

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

  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    for (const relative of SCRIPTS) {
      const filePath = path.join(repoRoot, relative);
      if (!fs.existsSync(filePath)) {
        console.warn(`Omitido (no existe): ${relative}`);
        continue;
      }
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`Ejecutando ${relative}...`);
      await pool.query(sql);
      console.log(`OK: ${relative}`);
    }

    const counts = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM cat_012_departamento) AS departamentos,
        (SELECT count(*)::int FROM cat_013_municipio) AS municipios,
        (SELECT count(*)::int FROM cat_008_distrito) AS distritos
    `);
    console.log('\nCatalogos ubicacion:', counts.rows[0]);

    const legacy = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('cat_005_departamentos', 'cat_006_municipios', 'cat_008_distritos')
    `);
    console.log('Tablas viejas restantes:', legacy.rows);

    const verifyPath = path.join(repoRoot, 'scripts/verify-ubicacion-emisores.sql');
    if (fs.existsSync(verifyPath)) {
      const verifySql = fs.readFileSync(verifyPath, 'utf8');
      const result = await pool.query(verifySql);
      console.log('\nRegistros con ubicacion invalida:', result.rowCount);
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
