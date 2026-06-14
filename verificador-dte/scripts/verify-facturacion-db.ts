import pg from 'pg';

import { getFacturacionDatabaseUrl } from '../lib/facturacion-database-url';

async function main() {
  const pool = new pg.Pool({ connectionString: getFacturacionDatabaseUrl() });

  const tables = await pool.query<{ n: number }>(`
    SELECT count(*)::int AS n
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (
        table_name LIKE 'cat_%'
        OR table_name IN ('usuarios', 'emisores', 'receptores', 'clientes', 'dte_emisiones')
      )
  `);

  const departamentos = await pool.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM cat_005_departamentos',
  );

  console.log('URL:', getFacturacionDatabaseUrl().replace(/:[^:@/]+@/, ':***@'));
  console.log('tablas facturacion:', tables.rows[0]?.n ?? 0);
  console.log('departamentos (cat_005):', departamentos.rows[0]?.n ?? 0);

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
