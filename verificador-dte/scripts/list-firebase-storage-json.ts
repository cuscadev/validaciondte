/**
 * Lista archivos .json en Firebase Storage (descubrimiento para migración).
 *
 * Uso:
 *   pnpm exec tsx scripts/list-firebase-storage-json.ts
 *   pnpm exec tsx scripts/list-firebase-storage-json.ts --prefix facturacion/
 */

import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

const prefixArg = process.argv.find((a) => a.startsWith('--prefix='))?.split('=')[1];
const prefixes = prefixArg
  ? [prefixArg]
  : ['', 'facturacion/', 'facturacion/emisiones/', 'dte/', 'dtes/', 'emisiones/', 'users/'];

async function listJsonUnderPrefix(bucket: ReturnType<ReturnType<typeof import('firebase-admin/storage').getStorage>['bucket']>, prefix: string) {
  const [files] = await bucket.getFiles({ prefix, autoPaginate: true });
  return files.filter((f) => f.name.toLowerCase().endsWith('.json'));
}

async function main() {
  const { adminStorage } = await import('../lib/firebase-admin');
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    '';
  const bucket = adminStorage.bucket(bucketName || undefined);

  console.log('Bucket:', bucket.name);
  console.log('Prefijos a explorar:', prefixes.join(', ') || '(raíz)');

  let total = 0;
  const samples: string[] = [];

  for (const prefix of prefixes) {
    try {
      const jsonFiles = await listJsonUnderPrefix(bucket, prefix);
      if (jsonFiles.length === 0) continue;
      console.log(`\n[${prefix || '/'}] ${jsonFiles.length} archivo(s) .json`);
      for (const file of jsonFiles.slice(0, 5)) {
        console.log('  -', file.name, `(${(Number(file.metadata?.size) || 0)} bytes)`);
        samples.push(file.name);
      }
      if (jsonFiles.length > 5) {
        console.log(`  ... y ${jsonFiles.length - 5} más`);
      }
      total += jsonFiles.length;
    } catch (error) {
      console.warn(`[warn] prefix "${prefix}":`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\nTotal JSON encontrados: ${total}`);
  if (total === 0) {
    console.log('No hay .json en los prefijos probados. Prueba: --prefix=tu/ruta/');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
