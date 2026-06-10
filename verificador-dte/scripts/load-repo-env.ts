import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

/** Raiz del monorepo (validaciondte/), un nivel arriba de verificador-dte/. */
export const repoRoot = resolve(process.cwd(), '..');

export const repoEnvLocalPath = resolve(repoRoot, '.env.local');
export const repoEnvPath = resolve(repoRoot, '.env');

export function loadRepoEnv() {
  loadEnv({ path: repoEnvLocalPath });
  loadEnv({ path: repoEnvPath });
}
