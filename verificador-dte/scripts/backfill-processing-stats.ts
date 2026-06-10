// Backfill userProcessingStats/{uid}/days/{date} from existing processingLogs.
// Ejecutar con: pnpm exec tsx scripts/backfill-processing-stats.ts
//
// Variables opcionales:
//   BACKFILL_UID=<firebase-uid>   — solo un usuario
//   BACKFILL_BATCH_SIZE=500       — docs por lote de lectura

import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { loadRepoEnv } from './load-repo-env';

loadRepoEnv();

type LogRow = {
  uid: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  createdAt: Date | null;
};

type DayBucket = {
  processes: number;
  records: number;
  successCount: number;
  errorCount: number;
};

function serializeDate(value: unknown): Date | null {
  if (!value) return null;

  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;

    if (typeof record.toDate === 'function') {
      return (record.toDate as () => Date)();
    }

    if (value instanceof Date) {
      return value;
    }
  }

  return null;
}

async function backfillProcessingStats() {
  const targetUid = (process.env.BACKFILL_UID || process.argv[2] || '').trim();
  const batchSize = Number(process.env.BACKFILL_BATCH_SIZE || 500);

  const { adminDb } = await import('../lib/firebase-admin');
  const { getDateKeyInTimezone } = await import('../lib/dashboard-stats');

  const buckets = new Map<string, DayBucket>();

  function bucketKey(uid: string, dateKey: string) {
    return `${uid}::${dateKey}`;
  }

  function addToBucket(uid: string, dateKey: string, log: LogRow) {
    const key = bucketKey(uid, dateKey);
    const existing = buckets.get(key) ?? {
      processes: 0,
      records: 0,
      successCount: 0,
      errorCount: 0,
    };

    existing.processes += 1;
    existing.records += log.totalRecords;
    existing.successCount += log.successCount;
    existing.errorCount += log.errorCount;
    buckets.set(key, existing);
  }

  let lastDoc: QueryDocumentSnapshot | null = null;
  let scanned = 0;

  console.log(
    targetUid
      ? `Backfill para uid=${targetUid}`
      : 'Backfill global de processingLogs'
  );

  while (true) {
    let query = adminDb
      .collection('processingLogs')
      .orderBy('createdAt', 'asc')
      .limit(batchSize);

    if (targetUid) {
      query = adminDb
        .collection('processingLogs')
        .where('uid', '==', targetUid)
        .orderBy('createdAt', 'asc')
        .limit(batchSize);
    }

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const data = doc.data();
      const uid = String(data.uid || '').trim();
      if (!uid) continue;

      const createdAt = serializeDate(data.createdAt);
      if (!createdAt) continue;

      addToBucket(uid, getDateKeyInTimezone(createdAt), {
        uid,
        totalRecords: Number(data.totalRecords || 0),
        successCount: Number(data.successCount || 0),
        errorCount: Number(data.errorCount || 0),
        createdAt,
      });
    }

    scanned += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(`  leidos ${scanned} logs...`);

    if (snap.size < batchSize) break;
  }

  if (buckets.size === 0) {
    console.log('No hay logs para backfill.');
    return;
  }

  let written = 0;
  const entries = Array.from(buckets.entries());

  for (const [key, stats] of entries) {
    const [uid, dateKey] = key.split('::');
    await adminDb
      .collection('userProcessingStats')
      .doc(uid)
      .collection('days')
      .doc(dateKey)
      .set(
        {
          date: dateKey,
          processes: stats.processes,
          records: stats.records,
          successCount: stats.successCount,
          errorCount: stats.errorCount,
          updatedAt: new Date(),
          backfilledAt: new Date(),
        },
        { merge: true }
      );

    written += 1;
    if (written % 100 === 0) {
      console.log(`  escritos ${written}/${entries.length} docs diarios...`);
    }
  }

  console.log(`Backfill listo: ${written} docs en userProcessingStats/*/days/*`);
}

backfillProcessingStats().catch((error) => {
  console.error('Error en backfill:', error);
  process.exitCode = 1;
});
