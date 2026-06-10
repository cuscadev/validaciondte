/**
 * Valida que exista un unico .env.local en la raiz y no haya archivos legacy.
 * Uso: pnpm run verify:env
 */
import { existsSync } from 'fs';
import { resolve } from 'path';
import { loadRepoEnv, repoEnvLocalPath, repoRoot } from './load-repo-env';

const legacyPaths = [
  resolve(repoRoot, '.env'),
  resolve(repoRoot, 'verificador-dte', '.env.local'),
  resolve(repoRoot, 'verificador-dte', '.env'),
];

function extractRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

function extractRefFromDbUrl(dbUrl: string | undefined): string | null {
  if (!dbUrl) return null;
  try {
    const host = new URL(dbUrl.replace(/^postgres(ql)?:\/\//, 'http://')).hostname;
    const match = host.match(/^db\.([^.]+)\.supabase\.co$/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function main() {
  let failed = false;

  if (!existsSync(repoEnvLocalPath)) {
    console.error(`Falta ${repoEnvLocalPath}`);
    console.error('Copia .env.example a .env.local en la raiz del repo.');
    process.exit(1);
  }

  console.log(`OK .env.local en raiz: ${repoEnvLocalPath}`);

  for (const legacy of legacyPaths) {
    if (existsSync(legacy)) {
      console.warn(`WARN archivo legacy detectado (eliminar o vaciar): ${legacy}`);
      failed = true;
    }
  }

  loadRepoEnv();

  const urlRef = extractRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const dbRef = extractRefFromDbUrl(process.env.SUPABASE_DB_URL?.trim());

  if (urlRef && dbRef && urlRef !== dbRef) {
    console.error(
      `FAIL Supabase desalineado: NEXT_PUBLIC_SUPABASE_URL=${urlRef}, SUPABASE_DB_URL=${dbRef}`
    );
    failed = true;
  } else if (urlRef && dbRef) {
    console.log(`OK Supabase project ref alineado: ${urlRef}`);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && !process.env.SUPABASE_SECRET_KEY?.trim()) {
    console.warn('WARN Falta SUPABASE_SERVICE_ROLE_KEY (sb_secret_...) para IMAP REST');
  }

  if (failed) {
    process.exit(1);
  }

  console.log('Entorno unificado OK.');
}

main();
