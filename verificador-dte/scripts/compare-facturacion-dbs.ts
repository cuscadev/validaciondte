import pg from 'pg';

import { getFacturacionDatabaseUrl } from '../lib/facturacion-database-url';

const LOCAL_URL =
  process.env.LOCAL_DATABASE_URL ||
  'postgres://facturacion:facturacion123@localhost:5433/facturacion?sslmode=disable';

const TRANSACTIONAL = [
  'usuarios',
  'emisores',
  'clientes',
  'usuario_emisor',
  'emisor_configuracion',
  'log_transacciones',
  'auditoria_cambios',
];

async function count(pool: pg.Pool, table: string) {
  try {
    const result = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM "${table}"`,
    );
    return Number(result.rows[0]?.n || 0);
  } catch {
    return -1;
  }
}

async function main() {
  const local = new pg.Pool({ connectionString: LOCAL_URL });
  const remote = new pg.Pool({ connectionString: getFacturacionDatabaseUrl() });

  console.log('tabla | local | supabase');
  for (const table of TRANSACTIONAL) {
    const localN = await count(local, table);
    const remoteN = await count(remote, table);
    console.log(`${table} | ${localN} | ${remoteN}`);
  }

  await local.end();
  await remote.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
