import {
  lookupDocumentsBatch,
  type EmailDocumentRow,
} from '@/lib/email-import/documents-api';
import { chunkArray, LOOKUP_CHUNK_SIZE } from '@/lib/email-import/sync-concurrency';

export function messageAttachmentKey(messageId: string, attachmentId: string): string {
  return `${messageId}:${attachmentId}`;
}

export class SyncDedupCache {
  private byAttachment = new Map<string, EmailDocumentRow>();
  private byHash = new Map<string, EmailDocumentRow>();

  getByAttachment(messageId: string, attachmentId: string): EmailDocumentRow | null {
    return this.byAttachment.get(messageAttachmentKey(messageId, attachmentId)) ?? null;
  }

  getByHash(contentHash: string): EmailDocumentRow | null {
    return this.byHash.get(contentHash) ?? null;
  }

  remember(doc: EmailDocumentRow) {
    if (doc.gmail_message_id && doc.gmail_attachment_id) {
      this.byAttachment.set(
        messageAttachmentKey(doc.gmail_message_id, doc.gmail_attachment_id),
        doc
      );
    }
    if (doc.content_hash) {
      this.byHash.set(doc.content_hash, doc);
    }
  }

  async preloadAttachments(
    organizationId: string,
    refs: Array<{ messageId: string; attachmentId: string }>
  ) {
    const keys = [
      ...new Set(
        refs
          .map((ref) => messageAttachmentKey(ref.messageId, ref.attachmentId))
          .filter((key) => key !== ':' && !this.byAttachment.has(key))
      ),
    ];
    if (keys.length === 0) return;

    for (const chunk of chunkArray(keys, LOOKUP_CHUNK_SIZE)) {
      const batch = await lookupDocumentsBatch(organizationId, {
        messageAttachmentKeys: chunk,
      });
      for (const [key, doc] of Object.entries(batch.byMessageAttachment)) {
        this.byAttachment.set(key, doc);
      }
    }
  }

  async preloadHashes(organizationId: string, hashes: string[]) {
    const pending = [
      ...new Set(hashes.filter((hash) => hash && !this.byHash.has(hash))),
    ];
    if (pending.length === 0) return;

    for (const chunk of chunkArray(pending, LOOKUP_CHUNK_SIZE)) {
      const batch = await lookupDocumentsBatch(organizationId, {
        contentHashes: chunk,
      });
      for (const [hash, doc] of Object.entries(batch.byContentHash)) {
        this.byHash.set(hash, doc);
      }
    }
  }
}
