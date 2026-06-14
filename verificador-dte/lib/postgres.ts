import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

let pool: Pool | null = null;

function readGoEnvDatabaseUrl() {
  const envPath = path.resolve(process.cwd(), '..', 'go-dte-api', '.env');

  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    const match = raw.match(/^DATABASE_URL=(.+)$/m);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

export function getPostgresPool() {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.FACTURACION_DATABASE_URL ||
      readGoEnvDatabaseUrl() ||
      'postgres://facturacion:facturacion123@localhost:5433/facturacion?sslmode=disable';

    pool = new Pool({ connectionString });
  }

  return pool;
}
