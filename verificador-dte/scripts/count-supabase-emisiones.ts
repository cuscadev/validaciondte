import pg from 'pg';

import { getFacturacionDatabaseUrl } from '../lib/facturacion-database-url';

async function main() {
  const pool = new pg.Pool({ connectionString: getFacturacionDatabaseUrl() });

  const tables = await pool.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'dte_emisiones%'
    ORDER BY 1
  `);
  console.log('tablas dte_emisiones:', tables.rows.map((r) => r.table_name));

  try {
    const count = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM v_dte_emisiones');
    console.log('total emisiones:', count.rows[0]?.n ?? 0);

    const byTipo = await pool.query<{ tipo_dte: string; n: number }>(
      'SELECT tipo_dte, count(*)::int AS n FROM v_dte_emisiones GROUP BY tipo_dte ORDER BY tipo_dte',
    );
    console.log('por tipo:', byTipo.rows);
  } catch (error) {
    console.error('v_dte_emisiones no existe o está vacía:', error instanceof Error ? error.message : error);
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
