import { createHash, randomUUID } from 'crypto';

import {
  createSyncJob,
  findDocumentByHash,
  findDocumentByMessageAttachment,
  getSyncJob,
  recordDocument,
  updateSyncJob,
} from '@/lib/gmail/firebase-db';
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
import { decryptImapSecret } from '@/lib/imap/credentials-crypto';
import { getActiveImapConnection } from '@/lib/imap/firebase-db';

export type ImapSyncBatchResult = {
  job: GmailSyncJobRow;
  batchDocuments: GmailDocumentRow[];
};

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
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
      source: 'imap',
    });
  }

  const batchDocuments: GmailDocumentRow[] = [];
  let found = job.found_count;
  let imported = job.imported_count;
  let skipped = job.skipped_count;
  let errors = job.error_count;

  const client = createImapClient({
    host: connection.host,
    port: connection.port,
    secure: connection.secure,
    email: connection.email,
    password: decryptImapSecret(connection.password_enc),
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    let completed = false;
    let nextCursor: string | null = null;

    try {
      const uids = await searchMessageUids(client, job.date_from, job.date_to);
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

      // Fase 1: un solo FETCH de estructura/metadatos para todo el lote
      // (sin descargar contenido). Solo quedan los mensajes con JSON/ZIP.
      const candidates = await scanMessagesForJsonParts(client, batchUids, mailboxKey);

      for (const message of candidates) {
        for (const candidatePart of message.parts) {
          // Dedup antes de descargar: si esta parte ya se importo, no se baja de nuevo.
          let attachments;
          try {
            const knownKey = `${candidatePart.part}:${candidatePart.fileName}`;
            if (!candidatePart.isZip) {
              const priorByPart = await findDocumentByMessageAttachment(
                input.organizationId,
                message.meta.messageKey,
                knownKey
              );
              if (priorByPart) {
                found += 1;
                skipped += 1;
                batchDocuments.push(priorByPart);
                continue;
              }
            }
            // Fase 2: descargar solo la parte MIME del adjunto.
            attachments = await downloadCandidatePart(client, message.uid, candidatePart);
          } catch (partErr) {
            errors += 1;
            console.error('[imap-sync part]', partErr);
            continue;
          }

          for (const attachment of attachments) {
            found += 1;
            try {
              const priorByMessage = await findDocumentByMessageAttachment(
                input.organizationId,
                message.meta.messageKey,
                attachment.attachmentKey
              );
              if (priorByMessage) {
                skipped += 1;
                batchDocuments.push(priorByMessage);
                continue;
              }

              const contentHash = sha256(attachment.buffer);
              const existing = await findDocumentByHash(input.organizationId, contentHash);
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
              };

              if (!parsed) {
                skipped += 1;
                batchDocuments.push(
                  await recordDocument({ ...base, importStatus: 'skipped_invalid' })
                );
                continue;
              }

              if (!isAllowedTipoDte(parsed.tipoDte)) {
                skipped += 1;
                batchDocuments.push(
                  await recordDocument({ ...base, importStatus: 'skipped_unsupported_type' })
                );
                continue;
              }

              if (!isDateInRange(parsed.fecEmi, job.date_from, job.date_to)) {
                skipped += 1;
                batchDocuments.push(
                  await recordDocument({ ...base, importStatus: 'skipped_date' })
                );
                continue;
              }

              imported += 1;
              batchDocuments.push(await recordDocument({ ...base, importStatus: 'imported' }));
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
      },
      batchDocuments,
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
