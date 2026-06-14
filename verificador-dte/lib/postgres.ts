import { Pool } from 'pg';

import { getFacturacionDatabaseUrl } from '@/lib/facturacion-database-url';

let pool: Pool | null = null;

function poolMaxConnections() {
  const configured = Number(process.env.PG_POOL_MAX ?? process.env.DATABASE_POOL_MAX ?? 5);
  return Number.isFinite(configured) && configured > 0 ? configured : 5;
}

export function getPostgresPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getFacturacionDatabaseUrl(),
      max: poolMaxConnections(),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return pool;
}
