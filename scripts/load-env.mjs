/**
 * Carga variables desde .env.local (y opcionalmente .env) en la raiz del repo.
 * Uso: import { loadRepoEnv, repoRoot } from '../scripts/load-env.mjs';
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(__dirname, '..');

function loadEnvFile(filePath, { override = false } = {}) {
  if (!existsSync(filePath)) return false;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (override || !process.env[key]) {
      process.env[key] = value;
    }
  }
  return true;
}

/**
 * Carga .env.local (prioridad) y .env (fallback) desde la raiz del repo.
 */
export function loadRepoEnv() {
  const localPath = resolve(repoRoot, '.env.local');
  const envPath = resolve(repoRoot, '.env');
  const loadedLocal = loadEnvFile(localPath);
  loadEnvFile(envPath);
  return { loadedLocal, localPath, envPath };
}

export function repoEnvPath(name) {
  return resolve(repoRoot, name);
}
