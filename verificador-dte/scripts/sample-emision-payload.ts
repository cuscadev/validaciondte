import pg from 'pg';

import { getFacturacionDatabaseUrl } from '../lib/facturacion-database-url';

async function main() {
  const pool = new pg.Pool({ connectionString: getFacturacionDatabaseUrl() });
  const sample = await pool.query<{ id: string; codigo_generacion: string; has_dte: boolean }>(`
    SELECT id, codigo_generacion,
      (payload ? 'finalPackage' OR payload ? 'documentResponse') AS has_dte
    FROM dte_emisiones_01_consumidor_final
    LIMIT 3
  `);
  console.log('muestra tipo 01:', sample.rows);
  await pool.end();
}

main().catch(console.error);
