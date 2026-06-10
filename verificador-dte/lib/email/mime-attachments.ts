import { createHash } from 'crypto';
import { simpleParser } from 'mailparser';

import { isJsonAttachment } from '@/lib/gmail/parse-dte-import';

export type EmailAttachmentRef = {
  messageUid: string;
  messageIdHeader: string;
  attachmentPartId: string;
  fileName: string;
  mimeType?: string;
  emailSubject: string;
  emailDate: string;
  buffer: Buffer;
};

function attachmentPartId(fileName: string, checksum: string): string {
  return `${fileName}:${checksum.slice(0, 16)}`;
}

export async function extractJsonAttachmentsFromSource(input: {
  messageUid: string;
  messageIdHeader: string;
  source: Buffer;
  emailSubject: string;
  emailDate: string;
}): Promise<EmailAttachmentRef[]> {
  const parsed = await simpleParser(input.source);
  const out: EmailAttachmentRef[] = [];

  for (const attachment of parsed.attachments || []) {
    const fileName = attachment.filename || attachment.contentType || 'attachment';
    if (!isJsonAttachment(fileName, attachment.contentType)) continue;

    const buffer = Buffer.isBuffer(attachment.content)
      ? attachment.content
      : Buffer.from(attachment.content);

    const checksum = createHash('sha256').update(buffer).digest('hex');

    out.push({
      messageUid: input.messageUid,
      messageIdHeader: input.messageIdHeader,
      attachmentPartId: attachmentPartId(fileName, checksum),
      fileName,
      mimeType: attachment.contentType,
      emailSubject: input.emailSubject,
      emailDate: input.emailDate,
      buffer,
    });
  }

  return out;
}
