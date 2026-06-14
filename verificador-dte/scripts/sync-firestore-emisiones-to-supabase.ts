/**
 * Migra emisiones existentes de Firestore (facturacionEmisiones) a Supabase.
 *
 * Uso:
 *   pnpm exec tsx scripts/sync-firestore-emisiones-to-supabase.ts --dry-run
 *   pnpm exec tsx scripts/sync-firestore-emisiones-to-supabase.ts
 */

import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'node:crypto';

import {
  createEmision,
  getEmisionById,
  type TipoDteEmision,
} from '../lib/facturacion/emisiones-store';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

const dryRun = process.argv.includes('--dry-run');
const limit = Number(process.env.SYNC_EMISIONES_LIMIT || 0);

const VALID_TIPOS = new Set<TipoDteEmision>(['01', '03', '05', '06', '11', '14']);

function asTipoDte(value: unknown): TipoDteEmision | null {
  const tipo = String(value || '').trim();
  return VALID_TIPOS.has(tipo as TipoDteEmision) ? (tipo as TipoDteEmision) : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function main() {
  const { adminDb } = await import('../lib/firebase-admin');
  const snap = await adminDb.collection('facturacionEmisiones').get();

  let migrated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    if (limit > 0 && migrated + skipped >= limit) break;

    const data = doc.data();
    const tipoDte = asTipoDte(data.tipoDte);
    if (!tipoDte) {
      console.warn(`[skip] ${doc.id}: tipoDte invalido (${data.tipoDte})`);
      skipped += 1;
      continue;
    }

    const targetId = isUuid(doc.id) ? doc.id : randomUUID();
    const existing = await getEmisionById(targetId);
    if (existing) {
      console.log(`[skip] ${doc.id} -> ya existe en Supabase (${targetId})`);
      skipped += 1;
      continue;
    }

    const payload = {
      ...data,
      firestoreId: doc.id,
      uid: data.uid,
      tipoDte,
      migratedFromFirestoreAt: new Date().toISOString(),
    };

    if (dryRun) {
      console.log(`[dry-run] ${doc.id} -> ${targetId} tipo ${tipoDte} status=${data.status}`);
      migrated += 1;
      continue;
    }

    await createEmision(tipoDte, payload, { id: targetId });
    migrated += 1;
    console.log(`[ok] ${doc.id} -> ${targetId} (${tipoDte})`);
  }

  console.log(`\n${dryRun ? 'DRY RUN' : 'Completado'}: migradas=${migrated} omitidas=${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
