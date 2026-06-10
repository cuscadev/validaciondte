/** @deprecated La sincronizacion IMAP corre en go-dte-api. Mantener para test de conexion IMAP en Node. */
import { createHash } from 'crypto';
import { ImapFlow } from 'imapflow';

import { decryptSecret } from '@/lib/email/credentials-crypto';
import type { EmailConnectionRow } from '@/lib/supabase-admin';

export const MESSAGES_PER_BATCH = 35;

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export type ImapSyncCursor = {
  uids: number[];
  index: number;
};

export function parseSyncCursor(raw: string | null): ImapSyncCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ImapSyncCursor;
    if (!Array.isArray(parsed.uids) || typeof parsed.index !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function serializeSyncCursor(cursor: ImapSyncCursor): string {
  return JSON.stringify(cursor);
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function buildImapSearchCriteria(dateFrom: string, dateTo: string) {
  return {
    since: new Date(`${dateFrom}T00:00:00.000Z`),
    before: new Date(`${addDays(dateTo, 1)}T00:00:00.000Z`),
  };
}

export async function createImapClient(connection: EmailConnectionRow): Promise<ImapFlow> {
  const password = decryptSecret(connection.password_enc);
  const client = new ImapFlow({
    host: connection.imap_host,
    port: connection.imap_port,
    secure: connection.imap_secure,
    auth: {
      user: connection.email_address,
      pass: password,
    },
    logger: false,
  });

  await client.connect();
  return client;
}

export async function testImapConnection(input: {
  emailAddress: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  mailboxFolder?: string;
}): Promise<void> {
  const client = new ImapFlow({
    host: input.imapHost,
    port: input.imapPort,
    secure: input.imapSecure,
    auth: {
      user: input.emailAddress,
      pass: input.password,
    },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(input.mailboxFolder || 'INBOX');
    lock.release();
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function testImapOAuthConnection(input: {
  emailAddress: string;
  accessToken: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  mailboxFolder?: string;
}): Promise<void> {
  const client = new ImapFlow({
    host: input.imapHost,
    port: input.imapPort,
    secure: input.imapSecure,
    auth: {
      user: input.emailAddress,
      accessToken: input.accessToken,
    },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(input.mailboxFolder || 'INBOX');
    lock.release();
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function searchMessageUids(
  client: ImapFlow,
  folder: string,
  dateFrom: string,
  dateTo: string
): Promise<number[]> {
  const lock = await client.getMailboxLock(folder);
  try {
    const criteria = buildImapSearchCriteria(dateFrom, dateTo);
    const uids = await client.search(criteria, { uid: true });
    return (uids || []).map(Number).sort((a, b) => a - b);
  } finally {
    lock.release();
  }
}

export async function fetchMessageSource(
  client: ImapFlow,
  folder: string,
  uid: number
): Promise<{ source: Buffer; envelopeSubject: string; envelopeDate: string; messageIdHeader: string }> {
  const lock = await client.getMailboxLock(folder);
  try {
    let source: Buffer | null = null;
    let envelopeSubject = '';
    let envelopeDate = new Date().toISOString();
    let messageIdHeader = '';

    for await (const message of client.fetch(
      `${uid}`,
      { uid: true, source: true, envelope: true },
      { uid: true }
    )) {
      if (message.source) {
        source = Buffer.from(message.source);
      }
      envelopeSubject = message.envelope?.subject || '';
      envelopeDate = message.envelope?.date?.toISOString() || envelopeDate;
      messageIdHeader = message.envelope?.messageId?.trim() || '';
      break;
    }

    if (!source) {
      throw new Error(`No se pudo descargar el mensaje UID ${uid}.`);
    }

    return { source, envelopeSubject, envelopeDate, messageIdHeader };
  } finally {
    lock.release();
  }
}

export async function listMessageBatch(input: {
  client: ImapFlow;
  folder: string;
  dateFrom: string;
  dateTo: string;
  cursor: string | null;
}): Promise<{ uids: number[]; nextCursor: string | null; completed: boolean }> {
  let syncCursor = parseSyncCursor(input.cursor);

  if (!syncCursor) {
    const allUids = await searchMessageUids(
      input.client,
      input.folder,
      input.dateFrom,
      input.dateTo
    );
    syncCursor = { uids: allUids, index: 0 };
  }

  const batch = syncCursor.uids.slice(
    syncCursor.index,
    syncCursor.index + MESSAGES_PER_BATCH
  );
  const nextIndex = syncCursor.index + batch.length;
  const completed = nextIndex >= syncCursor.uids.length;

  return {
    uids: batch,
    nextCursor: completed
      ? null
      : serializeSyncCursor({ uids: syncCursor.uids, index: nextIndex }),
    completed: completed && batch.length === 0 ? true : completed,
  };
}
