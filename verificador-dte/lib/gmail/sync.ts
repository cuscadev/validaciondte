import {
  buildGmailDateQuery,
  downloadAttachment,
  extractJsonAttachments,
  getGmailClient,
  listMessageIds,
  sha256,
  type GmailAttachmentRef,
} from '@/lib/gmail/client';
import { rebuildDocumentLinks } from '@/lib/gmail/link-documents';
import {
  getSyncJob,
  updateSyncJob,
  getActiveConnection,
} from '@/lib/gmail/firebase-db';
import { recordDocument } from '@/lib/email-import/documents-api';
import { mapConcurrent } from '@/lib/email-import/sync-concurrency';
import { SyncDedupCache } from '@/lib/email-import/sync-dedup-cache';
import { startSyncWithPlan } from '@/lib/email-import/sync-start';
import type { SyncPlanResult } from '@/lib/email-import/sync-plan';
import { isAllowedTipoDte, isDateInRange, parseDteForImport } from '@/lib/gmail/parse-dte-import';
import type { GmailDocumentRow, GmailSyncJobRow } from '@/lib/gmail/types';
import { randomUUID } from 'crypto';

export type SyncBatchResult = {
  job: GmailSyncJobRow;
  batchDocuments: GmailDocumentRow[];
  syncPlan?: SyncPlanResult;
};

const GMAIL_MESSAGE_CONCURRENCY = 10;
const GMAIL_DOWNLOAD_CONCURRENCY = 6;

export async function runSyncBatch(input: {
  organizationId: string;
  createdByUid: string;
  dateFrom?: string;
  dateTo?: string;
  jobId?: string;
}): Promise<SyncBatchResult> {
  const connection = await getActiveConnection(input.organizationId);
  if (!connection) {
    throw new Error('No hay cuenta Gmail conectada para esta organizacion.');
  }

  let job: GmailSyncJobRow | null = null;
  let syncPlan: SyncPlanResult | undefined;

  if (input.jobId) {
    job = await getSyncJob(input.jobId, input.organizationId);
    if (!job) throw new Error('Trabajo de sincronizacion no encontrado.');
    if (job.status === 'completed' || job.status === 'failed') {
      return { job, batchDocuments: [] };
    }
  } else {
    if (!input.dateFrom || !input.dateTo) {
      throw new Error('Indica dateFrom y dateTo para iniciar la sincronizacion.');
    }

    const start = await startSyncWithPlan({
      organizationId: input.organizationId,
      connectionId: connection.id,
      createdByUid: input.createdByUid,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      source: 'gmail',
    });
    syncPlan = start.plan;
    job = start.job;

    if (start.kind === 'cache_hit') {
      return { job, batchDocuments: [], syncPlan };
    }
  }

  const batchDocuments: GmailDocumentRow[] = [];
  let found = job.found_count;
  let imported = job.imported_count;
  let skipped = job.skipped_count;
  let errors = job.error_count;

  try {
    const gmail = await getGmailClient(connection);
    const query = buildGmailDateQuery(job.date_from, job.date_to);
    const { ids, nextPageToken } = await listMessageIds(gmail, query, job.cursor);

    const dedup = new SyncDedupCache();
    const attachmentGroups = await mapConcurrent(ids, GMAIL_MESSAGE_CONCURRENCY, async (messageId) => {
      try {
        return await extractJsonAttachments(gmail, messageId);
      } catch (messageErr) {
        errors += 1;
        console.error('[gmail-sync message]', messageErr);
        return [] as GmailAttachmentRef[];
      }
    });

    const allRefs = attachmentGroups.flat();
    await dedup.preloadAttachments(
      input.organizationId,
      allRefs.map((ref) => ({ messageId: ref.messageId, attachmentId: ref.attachmentId }))
    );

    const refsToDownload = allRefs.filter(
      (ref) => !dedup.getByAttachment(ref.messageId, ref.attachmentId)
    );

    const downloaded = await mapConcurrent(
      refsToDownload,
      GMAIL_DOWNLOAD_CONCURRENCY,
      async (ref) => {
        try {
          const buffer = await downloadAttachment(gmail, ref.messageId, ref.attachmentId);
          return { ref, buffer, contentHash: sha256(buffer) };
        } catch (downloadErr) {
          errors += 1;
          console.error('[gmail-sync download]', downloadErr);
          return null;
        }
      }
    );

    const validDownloads = downloaded.filter(
      (item): item is { ref: GmailAttachmentRef; buffer: Buffer; contentHash: string } =>
        item !== null
    );
    await dedup.preloadHashes(
      input.organizationId,
      validDownloads.map((item) => item.contentHash)
    );

    const downloadByKey = new Map(
      validDownloads.map((item) => [
        `${item.ref.messageId}:${item.ref.attachmentId}`,
        item,
      ])
    );

    for (const ref of allRefs) {
      found += 1;
      try {
        const priorByMessage = dedup.getByAttachment(ref.messageId, ref.attachmentId);
        if (priorByMessage) {
          skipped += 1;
          batchDocuments.push(priorByMessage);
          continue;
        }

        const item = downloadByKey.get(`${ref.messageId}:${ref.attachmentId}`);
        if (!item) {
          errors += 1;
          continue;
        }

        const existing = dedup.getByHash(item.contentHash);
        if (existing) {
          skipped += 1;
          batchDocuments.push(existing);
          continue;
        }

        const parsed = parseDteForImport(item.buffer);
        const base = {
          organizationId: input.organizationId,
          connectionId: connection.id,
          syncJobId: job.id,
          documentId: randomUUID(),
          ref,
          contentHash: item.contentHash,
          fileSize: item.buffer.length,
          buffer: item.buffer,
          parsed,
          mailboxEmail: connection.google_email,
          createdByUid: job.created_by_uid || input.createdByUid,
        };

        if (!parsed) {
          skipped += 1;
          const doc = await recordDocument({
            ...base,
            importStatus: 'skipped_invalid',
          });
          dedup.remember(doc);
          batchDocuments.push(doc);
          continue;
        }

        if (!isAllowedTipoDte(parsed.tipoDte)) {
          skipped += 1;
          const doc = await recordDocument({
            ...base,
            importStatus: 'skipped_unsupported_type',
          });
          dedup.remember(doc);
          batchDocuments.push(doc);
          continue;
        }

        if (!isDateInRange(parsed.fecEmi, job.date_from, job.date_to)) {
          skipped += 1;
          const doc = await recordDocument({
            ...base,
            importStatus: 'skipped_date',
          });
          dedup.remember(doc);
          batchDocuments.push(doc);
          continue;
        }

        imported += 1;
        const doc = await recordDocument({
          ...base,
          importStatus: 'imported',
        });
        dedup.remember(doc);
        batchDocuments.push(doc);
      } catch (attachmentErr) {
        errors += 1;
        console.error('[gmail-sync attachment]', attachmentErr);
      }
    }

    const completed = !nextPageToken;
    await updateSyncJob(input.organizationId, job.id, {
      status: completed ? 'completed' : 'running',
      cursor: nextPageToken,
      found_count: found,
      imported_count: imported,
      skipped_count: skipped,
      error_count: errors,
      finished_at: completed ? new Date().toISOString() : null,
    });

    if (completed) {
      await rebuildDocumentLinks(input.organizationId);
    }

    const refreshed = await getSyncJob(job.id, input.organizationId);
    return {
      job: refreshed || {
        ...job,
        status: completed ? 'completed' : 'running',
        found_count: found,
        imported_count: imported,
        skipped_count: skipped,
        error_count: errors,
        cursor: nextPageToken,
      },
      batchDocuments,
      syncPlan,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en sincronizacion';
    await updateSyncJob(input.organizationId, job.id, {
      status: 'failed',
      error_message: message,
      found_count: found,
      imported_count: imported,
      skipped_count: skipped,
      error_count: errors,
      finished_at: new Date().toISOString(),
    });
    throw err;
  }
}

export async function runSyncUntilComplete(input: {
  organizationId: string;
  createdByUid: string;
  dateFrom?: string;
  dateTo?: string;
  jobId?: string;
  maxBatches?: number;
}): Promise<SyncBatchResult> {
  const maxBatches = input.maxBatches ?? 1;
  let result = await runSyncBatch(input);
  let batches = 1;

  while (result.job.status === 'running' && batches < maxBatches) {
    result = await runSyncBatch({
      organizationId: input.organizationId,
      createdByUid: input.createdByUid,
      jobId: result.job.id,
    });
    batches += 1;
  }

  return result;
}
