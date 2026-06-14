import { Pool } from 'pg';

import { getFacturacionDatabaseUrl } from '@/lib/facturacion-database-url';

let pool: Pool | null = null;

export function getPostgresPool() {
  if (!pool) {
    pool = new Pool({ connectionString: getFacturacionDatabaseUrl() });
  }

  return pool;
}
