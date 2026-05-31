import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getDateKeyInTimezone } from '@/lib/dashboard-stats';

export type ProcessingStatsIncrement = {
  totalRecords: number;
  successCount: number;
  errorCount: number;
};

export async function incrementUserProcessingStats(
  uid: string,
  stats: ProcessingStatsIncrement,
  at = new Date()
) {
  if (!uid) return;

  const dateKey = getDateKeyInTimezone(at);
  const ref = adminDb
    .collection('userProcessingStats')
    .doc(uid)
    .collection('days')
    .doc(dateKey);

  await ref.set(
    {
      date: dateKey,
      processes: FieldValue.increment(1),
      records: FieldValue.increment(Number(stats.totalRecords || 0)),
      successCount: FieldValue.increment(Number(stats.successCount || 0)),
      errorCount: FieldValue.increment(Number(stats.errorCount || 0)),
      updatedAt: new Date(),
    },
    { merge: true }
  );
}
