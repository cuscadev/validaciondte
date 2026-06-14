const pg = require('pg');
const { readFileSync } = require('fs');
const { join } = require('path');

function loadDbUrl() {
  const envPath = join(__dirname, '..', '..', 'go-dte-api', '.env');
  const text = readFileSync(envPath, 'utf8');
  const match = text.match(/^SUPABASE_DB_URL=(.+)$/m);
  if (!match) throw new Error('SUPABASE_DB_URL not found in go-dte-api/.env');
  return match[1].trim();
}

async function main() {
  const client = new pg.Client({
    connectionString: loadDbUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const checks = [
    ['max_muni_len', 'SELECT MAX(LENGTH(codigo))::text AS v FROM cat_006_municipios'],
    ['distrito_count', 'SELECT COUNT(*)::text AS v FROM cat_008_distritos'],
    ['muni_count', 'SELECT COUNT(*)::text AS v FROM cat_006_municipios'],
    [
      'legacy_emisores',
      `SELECT COUNT(*)::text AS v FROM emisores WHERE municipio_codigo IS NOT NULL AND LENGTH(municipio_codigo) > 2`,
    ],
    [
      'legacy_clientes',
      `SELECT COUNT(*)::text AS v FROM clientes WHERE municipio_codigo IS NOT NULL AND LENGTH(municipio_codigo) > 2`,
    ],
    ['cat013_count', 'SELECT COUNT(*)::text AS v FROM cat_013_tipo_dte WHERE COALESCE(activo, TRUE) = TRUE'],
  ];

  console.log('=== Phase 1 DB checks ===');
  for (const [name, sql] of checks) {
    try {
      const result = await client.query(sql);
      console.log(`${name}: ${result.rows[0]?.v ?? 'null'}`);
    } catch (error) {
      console.log(`${name}: ERROR ${error.message}`);
    }
  }

  const verifySql = readFileSync(join(__dirname, '..', '..', 'scripts', 'verify-ubicacion-emisores.sql'), 'utf8');
  const invalid = await client.query(verifySql);
  console.log(`invalid_rows: ${invalid.rowCount}`);
  if (invalid.rowCount > 0) {
    console.log(JSON.stringify(invalid.rows, null, 2));
  }

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
