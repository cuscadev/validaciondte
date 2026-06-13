import {
  countDocumentsInRange,
} from '@/lib/email-import/documents-api';
import { resolveSyncPlan, type SyncPlanResult } from '@/lib/email-import/sync-plan';
import {
  createSyncJob,
  getSyncJob,
  listCompletedSyncJobs,
  updateSyncJob,
} from '@/lib/gmail/firebase-db';
import type { DteImportSource, GmailSyncJobRow } from '@/lib/gmail/types';

export type SyncStartResult =
  | {
      kind: 'cache_hit';
      plan: SyncPlanResult;
      job: GmailSyncJobRow;
    }
  | {
      kind: 'scan';
      plan: SyncPlanResult;
      job: GmailSyncJobRow;
    };

export async function startSyncWithPlan(input: {
  organizationId: string;
  connectionId: string;
  createdByUid: string;
  dateFrom: string;
  dateTo: string;
  source: DteImportSource;
}): Promise<SyncStartResult> {
  const completedJobs = await listCompletedSyncJobs(
    input.organizationId,
    input.source
  );
  const plan = resolveSyncPlan({
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    completedJobs,
  });

  if (plan.action === 'cache_hit') {
    const documentCount = await countDocumentsInRange({
      organizationId: input.organizationId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      source: input.source,
    });
    plan.documentCount = documentCount;

    const job = await createSyncJob({
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      createdByUid: input.createdByUid,
      source: input.source,
    });

    await updateSyncJob(input.organizationId, job.id, {
      status: 'completed',
      mailbox_skipped: true,
      finished_at: new Date().toISOString(),
    });

    const refreshed = await getSyncJob(job.id, input.organizationId);
    return {
      kind: 'cache_hit',
      plan,
      job: refreshed || { ...job, status: 'completed', mailbox_skipped: true },
    };
  }

  const job = await createSyncJob({
    organizationId: input.organizationId,
    connectionId: input.connectionId,
    dateFrom: plan.effectiveFrom,
    dateTo: plan.effectiveTo,
    createdByUid: input.createdByUid,
    source: input.source,
    requestedDateFrom: input.dateFrom,
    requestedDateTo: input.dateTo,
  });

  return { kind: 'scan', plan, job };
}
