import fs from 'node:fs';
import path from 'node:path';

function readGoEnvVar(name: string): string | undefined {
  const envPath = path.resolve(process.cwd(), '..', 'go-dte-api', '.env');

  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    const match = raw.match(new RegExp(`^${name}=(.+)$`, 'm'));
    const value = match?.[1]?.trim().replace(/^"|"$/g, '');
    return value || undefined;
  } catch {
    return undefined;
  }
}

/** URL Postgres para facturación: Supabase (misma BD que go-dte-api). */
export function getFacturacionDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL?.trim() ||
    process.env.FACTURACION_DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    readGoEnvVar('DATABASE_URL') ||
    readGoEnvVar('SUPABASE_DB_URL');

  if (!url) {
    throw new Error(
      'Falta SUPABASE_DB_URL. Configurala en go-dte-api/.env o en verificador-dte/.env.local',
    );
  }

  return url;
}
