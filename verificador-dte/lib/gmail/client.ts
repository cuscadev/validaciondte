import { createHash } from 'crypto';
import { google, gmail_v1 } from 'googleapis';

import { createOAuth2Client, refreshAccessToken } from '@/lib/gmail/oauth';
import { decryptSecret } from '@/lib/gmail/token-crypto';
import type { GmailConnectionRow } from '@/lib/gmail/types';
import { updateConnectionTokens } from '@/lib/gmail/firebase-db';
import { isJsonAttachment } from '@/lib/gmail/parse-dte-json';

export type GmailAttachmentRef = {
  messageId: string;
  threadId: string;
  attachmentId: string;
  fileName: string;
  mimeType?: string;
  emailSubject: string;
  emailDate: string;
  emailFrom: string;
  emailFromName: string | null;
  emailTo: string[];
  emailCc: string[];
  snippet: string;
  internalDate: string | null;
};

const MESSAGES_PER_BATCH = 35;

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export { sha256, MESSAGES_PER_BATCH };

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function buildGmailDateQuery(dateFrom: string, dateTo: string): string {
  const after = dateFrom.replace(/-/g, '/');
  const before = addDays(dateTo, 1).replace(/-/g, '/');
  const keywords =
    '(factura OR "credito fiscal" OR "nota de credito" OR "nota de debito" OR DTE OR CCF)';
  return `after:${after} before:${before} has:attachment filename:json ${keywords}`;
}

async function persistTokens(
  connectionId: string,
  accessToken: string,
  expiresAt: Date | null
) {
  await updateConnectionTokens(connectionId, accessToken, expiresAt);
}

export async function getGmailClient(connection: GmailConnectionRow) {
  const refreshToken = decryptSecret(connection.refresh_token_enc);
  const oauth2 = createOAuth2Client();

  let accessToken = connection.access_token || '';
  let expiry = connection.token_expires_at
    ? new Date(connection.token_expires_at)
    : null;

  const needsRefresh =
    !accessToken || !expiry || expiry.getTime() <= Date.now() + 60_000;

  if (needsRefresh) {
    const credentials = await refreshAccessToken(refreshToken);
    accessToken = credentials.access_token || '';
    expiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
    await persistTokens(connection.id, accessToken, expiry);
  }

  oauth2.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken,
    expiry_date: expiry?.getTime(),
  });

  return google.gmail({ version: 'v1', auth: oauth2 });
}

function walkParts(
  parts: gmail_v1.Schema$MessagePart[] | undefined,
  out: gmail_v1.Schema$MessagePart[]
) {
  if (!parts) return;
  for (const part of parts) {
    if (part.parts?.length) walkParts(part.parts, out);
    else out.push(part);
  }
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
) {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
    ''
  );
}

function parseEmailHeader(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(?:"?([^"<]*)"?\s)?<([^>]+)>$/);
  if (!match) {
    return { name: null, email: trimmed };
  }
  return {
    name: match[1]?.trim() || null,
    email: match[2]?.trim() || trimmed,
  };
}

function splitEmailList(value: string) {
  if (!value.trim()) return [];
  return value
    .split(',')
    .map((item) => parseEmailHeader(item).email)
    .filter(Boolean);
}

export async function listMessageIds(
  gmail: gmail_v1.Gmail,
  query: string,
  pageToken?: string | null
) {
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: MESSAGES_PER_BATCH,
    pageToken: pageToken || undefined,
  });
  return {
    ids: (res.data.messages || []).map((m) => m.id!).filter(Boolean),
    nextPageToken: res.data.nextPageToken || null,
  };
}

export async function extractJsonAttachments(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<GmailAttachmentRef[]> {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const payload = res.data.payload;
  const parts: gmail_v1.Schema$MessagePart[] = [];
  if (payload) {
    if (payload.filename && payload.body?.attachmentId) {
      parts.push(payload);
    }
    walkParts(payload.parts, parts);
  }

  const subject = getHeader(res.data.payload?.headers, 'Subject');
  const dateHeader = getHeader(res.data.payload?.headers, 'Date');
  const fromHeader = getHeader(res.data.payload?.headers, 'From');
  const toHeader = getHeader(res.data.payload?.headers, 'To');
  const ccHeader = getHeader(res.data.payload?.headers, 'Cc');
  const from = parseEmailHeader(fromHeader);
  const emailDate = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
  const internalDate = res.data.internalDate
    ? new Date(Number(res.data.internalDate)).toISOString()
    : null;

  const refs: GmailAttachmentRef[] = [];
  for (const part of parts) {
    const fileName = part.filename || '';
    const attachmentId = part.body?.attachmentId;
    if (!attachmentId || !fileName) continue;
    if (!isJsonAttachment(fileName, part.mimeType)) continue;
    refs.push({
      messageId,
      threadId: res.data.threadId || '',
      attachmentId,
      fileName,
      mimeType: part.mimeType || undefined,
      emailSubject: subject,
      emailDate,
      emailFrom: from.email,
      emailFromName: from.name,
      emailTo: splitEmailList(toHeader),
      emailCc: splitEmailList(ccHeader),
      snippet: res.data.snippet || '',
      internalDate,
    });
  }
  return refs;
}

export async function downloadAttachment(
  gmail: gmail_v1.Gmail,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });
  const data = res.data.data || '';
  return Buffer.from(data, 'base64url');
}

export async function fetchGoogleEmailFromOAuth(
  oauth2: ReturnType<typeof createOAuth2Client>
): Promise<string> {
  const oauth2api = google.oauth2({ version: 'v2', auth: oauth2 });
  const { data } = await oauth2api.userinfo.get();
  const email = data.email?.trim();
  if (!email) throw new Error('No se pudo obtener el email de Google.');
  return email;
}

export async function fetchGoogleEmail(gmail: gmail_v1.Gmail): Promise<string> {
  const profile = await gmail.users.getProfile({ userId: 'me' });
  return profile.data.emailAddress || '';
}
