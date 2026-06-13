import { createHash, randomUUID } from 'crypto';

import { getSyncJob, updateSyncJob } from '@/lib/gmail/firebase-db';
import { recordDocument } from '@/lib/email-import/documents-api';
import { startSyncWithPlan } from '@/lib/email-import/sync-start';
import type { SyncPlanResult } from '@/lib/email-import/sync-plan';
import { SyncDedupCache } from '@/lib/email-import/sync-dedup-cache';
import { rebuildDocumentLinks } from '@/lib/gmail/link-documents';
import { isAllowedTipoDte, isDateInRange, parseDteForImport } from '@/lib/gmail/parse-dte-import';
import type { GmailAttachmentRef } from '@/lib/gmail/client';
import type { GmailDocumentRow, GmailSyncJobRow } from '@/lib/gmail/types';
import {
  IMAP_MESSAGES_PER_BATCH,
  createImapClient,
  downloadCandidatePart,
  scanMessagesForJsonParts,
  searchMessageUids,
} from '@/lib/imap/client';
import { buildImapConfig } from '@/lib/imap/auth';
import { getActiveImapConnection } from '@/lib/imap/firebase-db';

export type ImapSyncBatchResult = {
  job: GmailSyncJobRow;
  batchDocuments: GmailDocumentRow[];
  syncPlan?: SyncPlanResult;
};

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function parseImapUidCache(cache: string | null | undefined): number[] {
  if (!cache?.trim()) return [];
  return cache
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((uid) => Number.isFinite(uid) && uid > 0);
}

export async function runImapSyncBatch(input: {
  organizationId: string;
  createdByUid: string;
  dateFrom?: string;
  dateTo?: string;
  jobId?: string;
}): Promise<ImapSyncBatchResult> {
  const connection = await getActiveImapConnection(input.organizationId);
  if (!connection) {
    throw new Error('No hay cuenta IMAP conectada para esta organizacion.');
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
      source: 'imap',
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

  const client = createImapClient(await buildImapConfig(connection));
  const dedup = new SyncDedupCache();

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    let completed = false;
    let nextCursor: string | null = null;
    let uidCacheToPersist: string | null = null;

    try {
      let uids = parseImapUidCache(job.imap_uid_cache);
      if (uids.length === 0) {
        uids = await searchMessageUids(client, job.date_from, job.date_to);
        uidCacheToPersist = uids.join(',');
      }

      const mailbox = client.mailbox;
      const mailboxKey =
        mailbox && typeof mailbox === 'object'
          ? String(mailbox.uidValidity ?? 'inbox')
          : 'inbox';

      const offset = Math.max(Number(job.cursor || 0) || 0, 0);
      const batchUids = uids.slice(offset, offset + IMAP_MESSAGES_PER_BATCH);
      const nextOffset = offset + batchUids.length;
      completed = nextOffset >= uids.length;
      nextCursor = completed ? null : String(nextOffset);

      const candidates = await scanMessagesForJsonParts(client, batchUids, mailboxKey);

      const preloadRefs: Array<{ messageId: string; attachmentId: string }> = [];
      for (const message of candidates) {
        for (const candidatePart of message.parts) {
          if (!candidatePart.isZip) {
            preloadRefs.push({
              messageId: message.meta.messageKey,
              attachmentId: `${candidatePart.part}:${candidatePart.fileName}`,
            });
          }
        }
      }
      await dedup.preloadAttachments(input.organizationId, preloadRefs);

      for (const message of candidates) {
        for (const candidatePart of message.parts) {
          let attachments;
          try {
            const knownKey = `${candidatePart.part}:${candidatePart.fileName}`;
            if (!candidatePart.isZip) {
              const priorByPart = dedup.getByAttachment(message.meta.messageKey, knownKey);
              if (priorByPart) {
                found += 1;
                skipped += 1;
                batchDocuments.push(priorByPart);
                continue;
              }
            }
            attachments = await downloadCandidatePart(client, message.uid, candidatePart);
          } catch (partErr) {
            errors += 1;
            console.error('[imap-sync part]', partErr);
            continue;
          }

          const attachmentKeys = attachments.map((attachment) => ({
            messageId: message.meta.messageKey,
            attachmentId: attachment.attachmentKey,
          }));
          await dedup.preloadAttachments(input.organizationId, attachmentKeys);

          const pendingHashes: string[] = [];
          const pendingAttachments: Array<{
            attachment: (typeof attachments)[number];
            contentHash: string;
          }> = [];

          for (const attachment of attachments) {
            found += 1;
            const priorByMessage = dedup.getByAttachment(
              message.meta.messageKey,
              attachment.attachmentKey
            );
            if (priorByMessage) {
              skipped += 1;
              batchDocuments.push(priorByMessage);
              continue;
            }
            const contentHash = sha256(attachment.buffer);
            pendingHashes.push(contentHash);
            pendingAttachments.push({ attachment, contentHash });
          }

          await dedup.preloadHashes(input.organizationId, pendingHashes);

          for (const { attachment, contentHash } of pendingAttachments) {
            try {
              const existing = dedup.getByHash(contentHash);
              if (existing) {
                skipped += 1;
                batchDocuments.push(existing);
                continue;
              }

              const ref: GmailAttachmentRef = {
                messageId: message.meta.messageKey,
                threadId: '',
                attachmentId: attachment.attachmentKey,
                fileName: attachment.fileName,
                mimeType: 'application/json',
                emailSubject: message.meta.emailSubject,
                emailDate: message.meta.emailDate,
                emailFrom: message.meta.emailFrom,
                emailFromName: message.meta.emailFromName,
                emailTo: message.meta.emailTo,
                emailCc: message.meta.emailCc,
                snippet: '',
                internalDate: message.meta.internalDate,
              };

              const parsed = parseDteForImport(attachment.buffer);
              const base = {
                organizationId: input.organizationId,
                connectionId: connection.id,
                syncJobId: job.id,
                documentId: randomUUID(),
                ref,
                contentHash,
                fileSize: attachment.buffer.length,
                buffer: attachment.buffer,
                parsed,
                source: 'imap' as const,
                mailboxEmail: connection.email,
                createdByUid: job.created_by_uid || input.createdByUid,
              };

              if (!parsed) {
                skipped += 1;
                const doc = await recordDocument({ ...base, importStatus: 'skipped_invalid' });
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
                const doc = await recordDocument({ ...base, importStatus: 'skipped_date' });
                dedup.remember(doc);
                batchDocuments.push(doc);
                continue;
              }

              imported += 1;
              const doc = await recordDocument({ ...base, importStatus: 'imported' });
              dedup.remember(doc);
              batchDocuments.push(doc);
            } catch (attachmentErr) {
              errors += 1;
              console.error('[imap-sync attachment]', attachmentErr);
            }
          }
        }
      }
    } finally {
      lock.release();
    }

    await updateSyncJob(input.organizationId, job.id, {
      status: completed ? 'completed' : 'running',
      cursor: nextCursor,
      found_count: found,
      imported_count: imported,
      skipped_count: skipped,
      error_count: errors,
      finished_at: completed ? new Date().toISOString() : null,
      ...(uidCacheToPersist ? { imap_uid_cache: uidCacheToPersist } : {}),
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
        cursor: nextCursor,
        imap_uid_cache: uidCacheToPersist || job.imap_uid_cache || null,
      },
      batchDocuments,
      syncPlan,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en sincronizacion IMAP';
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
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function runImapSyncUntilComplete(input: {
  organizationId: string;
  createdByUid: string;
  dateFrom?: string;
  dateTo?: string;
  jobId?: string;
  maxBatches?: number;
}): Promise<ImapSyncBatchResult> {
  const maxBatches = input.maxBatches ?? 1;
  let result = await runImapSyncBatch(input);
  let batches = 1;

  while (result.job.status === 'running' && batches < maxBatches) {
    result = await runImapSyncBatch({
      organizationId: input.organizationId,
      createdByUid: input.createdByUid,
      jobId: result.job.id,
    });
    batches += 1;
  }

  return result;
}
