import {
  buildGmailDateQuery,
  downloadAttachment,
  extractJsonAttachments,
  getGmailClient,
  listMessageIds,
  sha256,
} from '@/lib/gmail/client';
import { rebuildDocumentLinks } from '@/lib/gmail/link-documents';
import {
  createSyncJob,
  findDocumentByHash,
  findDocumentByMessageAttachment,
  getActiveConnection,
  getSyncJob,
  recordDocument,
  updateSyncJob,
  uploadDocumentToStorage,
} from '@/lib/gmail/db';
import {
  isAllowedTipoDte,
  isDateInRange,
  parseDteForImport,
} from '@/lib/gmail/parse-dte-import';
import type { GmailDocumentRow, GmailSyncJobRow } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';

export type SyncBatchResult = {
  job: GmailSyncJobRow;
  batchDocuments: GmailDocumentRow[];
};

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
    job = await createSyncJob({
      organizationId: input.organizationId,
      connectionId: connection.id,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      createdByUid: input.createdByUid,
    });
  }

  const batchDocuments: GmailDocumentRow[] = [];
  let found = job.found_count;
  let imported = job.imported_count;
  let skipped = job.skipped_count;
  let errors = job.error_count;

  try {
    const gmail = await getGmailClient(connection);
    const query = buildGmailDateQuery(job.date_from, job.date_to);
    const { ids, nextPageToken } = await listMessageIds(
      gmail,
      query,
      job.cursor
    );

    for (const messageId of ids) {
      const attachments = await extractJsonAttachments(gmail, messageId);
      for (const ref of attachments) {
        found += 1;
        try {
          const priorByMessage = await findDocumentByMessageAttachment(
            ref.messageId,
            ref.attachmentId
          );
          if (priorByMessage) {
            skipped += 1;
            batchDocuments.push(priorByMessage);
            continue;
          }

          const buffer = await downloadAttachment(
            gmail,
            ref.messageId,
            ref.attachmentId
          );
          const contentHash = sha256(buffer);
          const existing = await findDocumentByHash(
            input.organizationId,
            contentHash
          );
          if (existing) {
            skipped += 1;
            batchDocuments.push(existing);
            continue;
          }

          const parsed = parseDteForImport(buffer);
          const base = {
            organizationId: input.organizationId,
            connectionId: connection.id,
            syncJobId: job.id,
            ref,
            contentHash,
            fileSize: buffer.length,
            parsed,
          };

          if (!parsed) {
            skipped += 1;
            const doc = await recordDocument({
              ...base,
              importStatus: 'skipped_invalid',
              storagePath: null,
            });
            batchDocuments.push(doc);
            continue;
          }

          if (!isAllowedTipoDte(parsed.tipoDte)) {
            skipped += 1;
            const doc = await recordDocument({
              ...base,
              importStatus: 'skipped_unsupported_type',
              storagePath: null,
            });
            batchDocuments.push(doc);
            continue;
          }

          if (!isDateInRange(parsed.fecEmi, job.date_from, job.date_to)) {
            skipped += 1;
            const doc = await recordDocument({
              ...base,
              importStatus: 'skipped_date',
              storagePath: null,
            });
            batchDocuments.push(doc);
            continue;
          }

          const documentId = randomUUID();
          const storagePath = await uploadDocumentToStorage(
            input.organizationId,
            documentId,
            buffer
          );
          imported += 1;
          const doc = await recordDocument({
            ...base,
            importStatus: 'imported',
            storagePath,
          });
          batchDocuments.push(doc);
        } catch (attachmentErr) {
          errors += 1;
          console.error('[gmail-sync attachment]', attachmentErr);
        }
      }
    }

    const completed = !nextPageToken;
    await updateSyncJob(job.id, {
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
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en sincronizacion';
    await updateSyncJob(job.id, {
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
