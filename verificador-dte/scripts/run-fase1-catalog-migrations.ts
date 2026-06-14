/**
 * Ejecuta scripts SQL de Fase 1 (catálogos ubicación, CAT-013, distritos, correlativos).
 * Uso: npx tsx scripts/run-fase1-catalog-migrations.ts
 */
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const repoRoot = path.resolve(__dirname, '../..');

const SCRIPTS = [
  'scripts/fix-ubicacion-v2.sql',
  'scripts/fix-cat-013-tipo-dte.sql',
  'scripts/seed-distritos-default.sql',
  'scripts/fix-emisor-config-correlativos.sql',
  'go-dte-api/db/dte-sequences-schema.sql',
];

async function main() {
  const databaseUrl =
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    console.error('SUPABASE_DB_URL o DATABASE_URL requerido.');
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

    const verifyPath = path.join(repoRoot, 'scripts/verify-ubicacion-emisores.sql');
    if (fs.existsSync(verifyPath)) {
      const verifySql = fs.readFileSync(verifyPath, 'utf8');
      const result = await pool.query(verifySql);
      console.log('\nVerificación ubicación emisores:');
      console.table(result.rows);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
