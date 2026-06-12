import { ImapFlow, type FetchMessageObject, type MessageStructureObject } from 'imapflow';
import JSZip from 'jszip';

import type { ImapConnectionConfig } from '@/lib/imap/types';

export const IMAP_MESSAGES_PER_BATCH = 200;

export type ImapJsonAttachment = {
  /** Identificador estable del adjunto dentro del mensaje. */
  attachmentKey: string;
  fileName: string;
  buffer: Buffer;
};

export type ImapMessageMeta = {
  messageKey: string;
  emailSubject: string;
  emailDate: string;
  emailFrom: string;
  emailFromName: string | null;
  emailTo: string[];
  emailCc: string[];
  internalDate: string | null;
};

export type ImapCandidatePart = {
  part: string;
  fileName: string;
  isZip: boolean;
};

export type ImapMessageCandidate = {
  uid: number;
  meta: ImapMessageMeta;
  parts: ImapCandidatePart[];
};

export function createImapClient(config: ImapConnectionConfig): ImapFlow {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.accessToken
      ? { user: config.email, accessToken: config.accessToken }
      : { user: config.email, pass: config.password || '' },
    logger: false,
    socketTimeout: 60_000,
    connectionTimeout: 30_000,
  });
}

type ImapFlowError = Error & {
  authenticationFailed?: boolean;
  response?: string;
  responseText?: string;
  serverResponseCode?: string;
  code?: string;
};

function describeImapError(err: unknown): string {
  const error = (err instanceof Error ? err : new Error(String(err))) as ImapFlowError;
  const raw = error.message || '';
  const serverText = String(error.responseText || error.response || '').trim();
  const combined = `${raw} ${serverText} ${error.code || ''}`.toLowerCase();

  if (combined.includes('application-specific password required')) {
    return 'Tu proveedor requiere una clave de aplicacion (no tu contrasena normal). Genera una clave de aplicacion e intentalo de nuevo.';
  }
  if (combined.includes('imap access is disabled') || combined.includes('imap is disabled')) {
    return 'El acceso IMAP esta deshabilitado en esta cuenta. Activalo en la configuracion de tu correo.';
  }
  if (
    error.authenticationFailed ||
    combined.includes('authenticationfailed') ||
    combined.includes('authentication') ||
    combined.includes('invalid credentials') ||
    combined.includes('login')
  ) {
    return `Credenciales IMAP invalidas. Verifica el correo y la clave de aplicacion.${
      serverText ? ` Respuesta del servidor: ${serverText}` : ''
    }`;
  }
  if (combined.includes('enotfound') || combined.includes('getaddrinfo')) {
    return 'No se encontro el servidor IMAP. Verifica el host.';
  }
  if (
    combined.includes('econnrefused') ||
    combined.includes('timeout') ||
    combined.includes('timed out')
  ) {
    return 'No se pudo conectar al servidor IMAP. Verifica el host, puerto y tu conexion.';
  }
  return `Error IMAP: ${serverText || raw}`;
}

export async function testImapConnection(config: ImapConnectionConfig): Promise<void> {
  const client = createImapClient(config);
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    lock.release();
  } catch (err) {
    const detail = err as ImapFlowError;
    console.error('[imap test-connection]', {
      message: detail.message,
      response: detail.response,
      responseText: detail.responseText,
      serverResponseCode: detail.serverResponseCode,
      code: detail.code,
      authenticationFailed: detail.authenticationFailed,
    });
    throw new Error(describeImapError(err));
  } finally {
    await client.logout().catch(() => undefined);
  }
}

function toUtcDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Busca UIDs de mensajes dentro del rango de fechas (inclusive) en el buzon abierto.
 * Devuelve los UIDs ordenados ascendentemente para que el cursor por offset sea estable.
 */
export async function searchMessageUids(
  client: ImapFlow,
  dateFrom: string,
  dateTo: string
): Promise<number[]> {
  const since = toUtcDate(dateFrom);
  const before = toUtcDate(dateTo);
  before.setUTCDate(before.getUTCDate() + 1);

  const uids = await client.search({ since, before }, { uid: true });
  if (!Array.isArray(uids)) return [];
  return uids.map(Number).filter((uid) => Number.isFinite(uid)).sort((a, b) => a - b);
}

type EnvelopeAddress = { name?: string; address?: string };

function addressList(value: EnvelopeAddress[] | undefined): string[] {
  return (value || []).map((addr) => addr.address || '').filter(Boolean);
}

function firstAddress(value: EnvelopeAddress[] | undefined): {
  email: string;
  name: string | null;
} {
  const addr = value?.[0];
  return {
    email: addr?.address || '',
    name: addr?.name?.trim() || null,
  };
}

/**
 * Recorre la estructura MIME del mensaje y devuelve solo las partes que
 * parecen adjuntos JSON o ZIP, sin descargar contenido.
 */
function collectCandidateParts(
  node: MessageStructureObject | undefined,
  out: ImapCandidatePart[]
) {
  if (!node) return;
  if (node.childNodes?.length) {
    for (const child of node.childNodes) collectCandidateParts(child, out);
    return;
  }
  if (!node.part) return;

  const fileName = String(
    node.dispositionParameters?.filename || node.parameters?.name || ''
  ).trim();
  const type = String(node.type || '').toLowerCase();
  const lower = fileName.toLowerCase();

  const isJson = lower.endsWith('.json') || type.includes('json');
  const isZip = lower.endsWith('.zip') || type.includes('zip');
  if (!isJson && !isZip) return;

  out.push({
    part: node.part,
    fileName: fileName || (isZip ? 'adjunto.zip' : 'adjunto.json'),
    isZip,
  });
}

function buildMessageMeta(message: FetchMessageObject, mailboxKey: string): ImapMessageMeta {
  const envelope = message.envelope;
  const from = firstAddress(envelope?.from as EnvelopeAddress[] | undefined);
  const date = envelope?.date || message.internalDate || null;
  const emailDate = date ? new Date(date).toISOString() : new Date().toISOString();
  return {
    messageKey:
      envelope?.messageId?.trim() || `imap:${mailboxKey}:${message.uid}`,
    emailSubject: envelope?.subject || '',
    emailDate,
    emailFrom: from.email,
    emailFromName: from.name,
    emailTo: addressList(envelope?.to as EnvelopeAddress[] | undefined),
    emailCc: addressList(envelope?.cc as EnvelopeAddress[] | undefined),
    internalDate: message.internalDate
      ? new Date(message.internalDate).toISOString()
      : emailDate,
  };
}

/**
 * Obtiene en un solo comando FETCH la estructura y metadatos de todos los UIDs
 * del lote, y devuelve solo los mensajes que tienen adjuntos JSON/ZIP.
 * No descarga el contenido de los mensajes.
 */
export async function scanMessagesForJsonParts(
  client: ImapFlow,
  uids: number[],
  mailboxKey: string
): Promise<ImapMessageCandidate[]> {
  if (!uids.length) return [];

  const candidates: ImapMessageCandidate[] = [];
  const range = uids.join(',');

  for await (const message of client.fetch(
    range,
    { uid: true, envelope: true, bodyStructure: true, internalDate: true },
    { uid: true }
  )) {
    const parts: ImapCandidatePart[] = [];
    collectCandidateParts(message.bodyStructure, parts);
    if (!parts.length) continue;
    candidates.push({
      uid: message.uid,
      meta: buildMessageMeta(message, mailboxKey),
      parts,
    });
  }

  return candidates;
}

async function extractZipJsonEntries(
  zipBuffer: Buffer,
  zipName: string,
  baseKey: string
): Promise<ImapJsonAttachment[]> {
  const out: ImapJsonAttachment[] = [];
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    return out;
  }
  const entries = Object.values(zip.files).filter(
    (entry) => !entry.dir && entry.name.toLowerCase().endsWith('.json')
  );
  for (const entry of entries) {
    try {
      const buffer = Buffer.from(await entry.async('nodebuffer'));
      out.push({
        attachmentKey: `${baseKey}!${entry.name}`,
        fileName: `${zipName}/${entry.name.split('/').pop() || entry.name}`,
        buffer,
      });
    } catch {
      // entrada corrupta: se omite
    }
  }
  return out;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Descarga solo la parte MIME indicada (el adjunto), no el mensaje completo.
 * Si la parte es un ZIP, extrae los .json que contenga.
 */
export async function downloadCandidatePart(
  client: ImapFlow,
  uid: number,
  candidate: ImapCandidatePart
): Promise<ImapJsonAttachment[]> {
  const download = await client.download(String(uid), candidate.part, { uid: true });
  if (!download?.content) return [];

  const buffer = await streamToBuffer(download.content);
  if (!buffer.length) return [];

  const baseKey = `${candidate.part}:${candidate.fileName}`;
  if (candidate.isZip) {
    return extractZipJsonEntries(buffer, candidate.fileName, baseKey);
  }
  return [{ attachmentKey: baseKey, fileName: candidate.fileName, buffer }];
}
