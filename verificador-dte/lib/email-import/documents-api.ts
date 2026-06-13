/**
 * Cliente HTTP hacia la API Go para documentos JSON importados del correo.
 * La BD Supabase solo se accede desde go-dte-api (SUPABASE_DB_URL).
 */
import { getGoDteApiUrl } from '@/lib/go-dte-api';
import type { GmailAttachmentRef } from '@/lib/gmail/client';
import type { ParsedDteImport } from '@/lib/gmail/parse-dte-import';
import type {
  DteImportSource,
  GmailDocumentImportStatus,
  GmailDocumentLinkRow,
  GmailDocumentRow,
} from '@/lib/gmail/types';

export type EmailDocumentRow = GmailDocumentRow & {
  json_data?: unknown;
};

type RecordDocumentInput = {
  organizationId: string;
  connectionId: string;
  syncJobId: string;
  documentId: string;
  ref: GmailAttachmentRef;
  contentHash: string;
  fileSize: number;
  buffer: Buffer;
  parsed: ParsedDteImport | null;
  importStatus: GmailDocumentImportStatus;
  source?: DteImportSource;
  mailboxEmail?: string;
  createdByUid?: string;
};

function internalHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  const key = process.env.GO_DTE_INTERNAL_API_KEY?.trim();
  if (key) headers['X-Go-Dte-Internal-Key'] = key;
  return headers;
}

async function goFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${getGoDteApiUrl()}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...internalHeaders(),
      ...(init?.headers || {}),
    },
  });
  return res;
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Go API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function mapDocument(doc: GmailDocumentRow): EmailDocumentRow {
  return {
    ...doc,
    email_cc: doc.email_cc || [],
    email_to: doc.email_to || [],
    related_codigos: doc.related_codigos || [],
  };
}

function parsedToApi(parsed: ParsedDteImport | null) {
  if (!parsed) return undefined;
  return {
    codigoGeneracion: parsed.codigoGeneracion,
    fecEmi: parsed.fecEmi,
    tipoDte: parsed.tipoDte,
    tipoDteLabel: parsed.tipoDteLabel,
    numeroControl: parsed.numeroControl || null,
    ambiente: parsed.ambiente || null,
    emisorNit: parsed.emisorNit || null,
    emisorNrc: parsed.emisorNrc || null,
    emisorNombre: parsed.emisorNombre || null,
    receptorNit: parsed.receptorNit || null,
    receptorNrc: parsed.receptorNrc || null,
    montoTotal: parsed.montoTotal,
    iva: parsed.iva,
    selloRecepcion: parsed.selloRecepcion || null,
    relatedCodigos: parsed.relatedDocuments.map((r) => r.codigoGeneracion),
  };
}

export async function findDocumentByMessageAttachment(
  organizationId: string,
  messageId: string,
  attachmentId: string
): Promise<EmailDocumentRow | null> {
  const params = new URLSearchParams({
    organizationId,
    messageId,
    attachmentId,
  });
  const payload = await parseJson<{ document: EmailDocumentRow | null }>(
    await goFetch(`/api/email-documents/lookup?${params}`)
  );
  return payload.document ? mapDocument(payload.document) : null;
}

export async function findDocumentByHash(
  organizationId: string,
  contentHash: string
): Promise<EmailDocumentRow | null> {
  const params = new URLSearchParams({ organizationId, contentHash });
  const payload = await parseJson<{ document: EmailDocumentRow | null }>(
    await goFetch(`/api/email-documents/lookup?${params}`)
  );
  return payload.document ? mapDocument(payload.document) : null;
}

export async function lookupDocumentsBatch(
  organizationId: string,
  input: {
    messageAttachmentKeys?: string[];
    contentHashes?: string[];
  }
): Promise<{
  byMessageAttachment: Record<string, EmailDocumentRow>;
  byContentHash: Record<string, EmailDocumentRow>;
}> {
  const payload = await parseJson<{
    byMessageAttachment?: Record<string, EmailDocumentRow>;
    byContentHash?: Record<string, EmailDocumentRow>;
  }>(
    await goFetch('/api/email-documents/lookup-batch', {
      method: 'POST',
      body: JSON.stringify({
        organizationId,
        messageAttachmentKeys: input.messageAttachmentKeys || [],
        contentHashes: input.contentHashes || [],
      }),
    })
  );

  const byMessageAttachment: Record<string, EmailDocumentRow> = {};
  for (const [key, doc] of Object.entries(payload.byMessageAttachment || {})) {
    byMessageAttachment[key] = mapDocument(doc);
  }

  const byContentHash: Record<string, EmailDocumentRow> = {};
  for (const [hash, doc] of Object.entries(payload.byContentHash || {})) {
    byContentHash[hash] = mapDocument(doc);
  }

  return { byMessageAttachment, byContentHash };
}

export async function recordDocument(input: RecordDocumentInput): Promise<EmailDocumentRow> {
  const payload = await parseJson<{ document: EmailDocumentRow }>(
    await goFetch('/api/email-documents', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: input.organizationId,
        firebaseUserId: input.createdByUid,
        connectionId: input.connectionId,
        syncJobId: input.syncJobId,
        documentId: input.documentId,
        source: input.source || 'gmail',
        mailboxEmail: input.mailboxEmail,
        ref: input.ref,
        contentHash: input.contentHash,
        fileSize: input.fileSize,
        rawJson: input.buffer.toString('utf8'),
        importStatus: input.importStatus,
        parsed: parsedToApi(input.parsed),
      }),
    })
  );
  return mapDocument(payload.document);
}

export async function getDocumentById(
  documentId: string,
  organizationId: string
): Promise<EmailDocumentRow | null> {
  const params = new URLSearchParams({ organizationId });
  const payload = await parseJson<{ document: EmailDocumentRow }>(
    await goFetch(`/api/email-documents/${encodeURIComponent(documentId)}?${params}`)
  );
  return payload.document ? mapDocument(payload.document) : null;
}

export type EmailDocumentSortBy =
  | 'email_date'
  | 'email_subject'
  | 'fec_emi'
  | 'emisor_nombre'
  | 'codigo_generacion'
  | 'monto_total'
  | 'tipo_dte'
  | 'created_at';

export type EmailDocumentSortDir = 'asc' | 'desc';

export async function listDocuments(input: {
  organizationId: string;
  syncJobId?: string;
  importStatus?: string;
  tipoDte?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  source?: string;
  mailbox?: string;
  limit?: number;
  offset?: number;
  sortBy?: EmailDocumentSortBy;
  sortDir?: EmailDocumentSortDir;
}): Promise<{ documents: GmailDocumentRow[]; total: number }> {
  const params = new URLSearchParams({ organizationId: input.organizationId });
  if (input.syncJobId) params.set('syncJobId', input.syncJobId);
  if (input.importStatus) params.set('importStatus', input.importStatus);
  if (input.tipoDte) params.set('tipoDte', input.tipoDte);
  if (input.dateFrom) params.set('dateFrom', input.dateFrom);
  if (input.dateTo) params.set('dateTo', input.dateTo);
  if (input.q) params.set('q', input.q);
  if (input.source) params.set('source', input.source);
  if (input.mailbox) params.set('mailbox', input.mailbox);
  if (input.limit != null) params.set('limit', String(input.limit));
  if (input.offset != null) params.set('offset', String(input.offset));
  if (input.sortBy) params.set('sortBy', input.sortBy);
  if (input.sortDir) params.set('sortDir', input.sortDir);

  const payload = await parseJson<{ documents: GmailDocumentRow[]; total: number }>(
    await goFetch(`/api/email-documents?${params}`)
  );
  return {
    documents: (payload.documents || []).map(mapDocument),
    total: payload.total || 0,
  };
}

export async function countDocumentsInRange(input: {
  organizationId: string;
  dateFrom: string;
  dateTo: string;
  source?: DteImportSource;
}): Promise<number> {
  const { total } = await listDocuments({
    organizationId: input.organizationId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    source: input.source,
    limit: 1,
    offset: 0,
  });
  return total;
}

export async function listImportedDocumentsForOrg(
  organizationId: string
): Promise<GmailDocumentRow[]> {
  const params = new URLSearchParams({ organizationId });
  const payload = await parseJson<{ documents: GmailDocumentRow[] }>(
    await goFetch(`/api/email-documents/imported?${params}`)
  );
  return (payload.documents || []).map(mapDocument);
}

export async function getDocumentsByIds(
  organizationId: string,
  ids: string[]
): Promise<EmailDocumentRow[]> {
  const payload = await parseJson<{ documents: EmailDocumentRow[] }>(
    await goFetch('/api/email-documents/by-ids', {
      method: 'POST',
      body: JSON.stringify({ organizationId, ids }),
    })
  );
  return (payload.documents || []).map(mapDocument);
}

export async function downloadDocumentJson(
  documentId: string,
  organizationId: string
): Promise<Buffer | null> {
  const params = new URLSearchParams({ organizationId });
  const res = await goFetch(
    `/api/email-documents/${encodeURIComponent(documentId)}/raw?${params}`
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Go API error ${res.status}`);
  }
  const text = await res.text();
  return Buffer.from(text, 'utf8');
}

export async function getLinkedDocuments(
  documentId: string,
  organizationId: string
): Promise<{ links: GmailDocumentLinkRow[]; documents: GmailDocumentRow[] }> {
  const params = new URLSearchParams({ organizationId });
  const payload = await parseJson<{
    links: GmailDocumentLinkRow[];
    documents: GmailDocumentRow[];
  }>(await goFetch(`/api/email-documents/${encodeURIComponent(documentId)}/links?${params}`));

  return {
    links: payload.links || [],
    documents: (payload.documents || []).map(mapDocument),
  };
}

export async function upsertDocumentLink(input: {
  organizationId: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  linkType: GmailDocumentLinkRow['link_type'];
}) {
  await parseJson<{ ok: boolean }>(
    await goFetch('/api/email-document-links', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: input.organizationId,
        sourceDocumentId: input.sourceDocumentId,
        targetDocumentId: input.targetDocumentId,
        linkType: input.linkType,
      }),
    })
  );
}
