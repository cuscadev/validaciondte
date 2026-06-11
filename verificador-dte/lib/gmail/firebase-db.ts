import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase-admin';
import type { GmailAttachmentRef } from '@/lib/gmail/client';
import type { ParsedDteImport } from '@/lib/gmail/parse-dte-import';
import type {
  GmailDocumentImportStatus,
  GmailDocumentLinkRow,
  GmailDocumentRow,
} from '@/lib/supabase-admin';

type JsonRecord = Record<string, unknown>;

export type FirebaseGmailDocumentRow = GmailDocumentRow & {
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
};

function documentsCollection(organizationId: string) {
  return adminDb
    .collection('organizations')
    .doc(organizationId)
    .collection('gmail_documents');
}

function linksCollection(organizationId: string) {
  return adminDb
    .collection('organizations')
    .doc(organizationId)
    .collection('gmail_document_links');
}

function asIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function parsedToDocumentFields(parsed: ParsedDteImport | null) {
  if (!parsed) {
    return {
      codigo_generacion: null,
      fec_emi: null,
      tipo_dte: null,
      tipo_dte_label: null,
      numero_control: null,
      ambiente: null,
      emisor_nit: null,
      emisor_nrc: null,
      emisor_nombre: null,
      receptor_nit: null,
      receptor_nrc: null,
      monto_total: null,
      iva: null,
      sello_recepcion: null,
      related_codigos: [] as string[],
    };
  }

  return {
    codigo_generacion: parsed.codigoGeneracion,
    fec_emi: parsed.fecEmi,
    tipo_dte: parsed.tipoDte,
    tipo_dte_label: parsed.tipoDteLabel,
    numero_control: parsed.numeroControl || null,
    ambiente: parsed.ambiente || null,
    emisor_nit: parsed.emisorNit || null,
    emisor_nrc: parsed.emisorNrc || null,
    emisor_nombre: parsed.emisorNombre || null,
    receptor_nit: parsed.receptorNit || null,
    receptor_nrc: parsed.receptorNrc || null,
    monto_total: parsed.montoTotal,
    iva: parsed.iva,
    sello_recepcion: parsed.selloRecepcion || null,
    related_codigos: parsed.relatedDocuments.map((r) => r.codigoGeneracion),
  };
}

function parseJsonBuffer(buffer: Buffer): unknown {
  try {
    return JSON.parse(buffer.toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

function mapDocumentSnapshot(
  snapshot: FirebaseFirestore.DocumentSnapshot
): FirebaseGmailDocumentRow {
  const data = (snapshot.data() || {}) as JsonRecord;
  return {
    id: snapshot.id,
    organization_id: String(data.organization_id || ''),
    connection_id: String(data.connection_id || ''),
    sync_job_id: data.sync_job_id ? String(data.sync_job_id) : null,
    gmail_message_id: String(data.gmail_message_id || ''),
    gmail_thread_id: data.gmail_thread_id ? String(data.gmail_thread_id) : null,
    gmail_attachment_id: String(data.gmail_attachment_id || ''),
    gmail_snippet: data.gmail_snippet ? String(data.gmail_snippet) : null,
    gmail_internal_date: asIso(data.gmail_internal_date),
    content_hash: String(data.content_hash || ''),
    file_name: String(data.file_name || ''),
    storage_path: data.storage_path ? String(data.storage_path) : null,
    file_size_bytes: Number(data.file_size_bytes || 0),
    email_subject: data.email_subject ? String(data.email_subject) : null,
    email_date: asIso(data.email_date),
    email_from: data.email_from ? String(data.email_from) : null,
    email_from_name: data.email_from_name ? String(data.email_from_name) : null,
    email_to: asStringArray(data.email_to),
    email_cc: asStringArray(data.email_cc),
    import_status: String(data.import_status || 'skipped_invalid') as GmailDocumentImportStatus,
    codigo_generacion: data.codigo_generacion ? String(data.codigo_generacion) : null,
    fec_emi: data.fec_emi ? String(data.fec_emi) : null,
    tipo_dte: data.tipo_dte ? String(data.tipo_dte) : null,
    tipo_dte_label: data.tipo_dte_label ? String(data.tipo_dte_label) : null,
    numero_control: data.numero_control ? String(data.numero_control) : null,
    ambiente: data.ambiente ? String(data.ambiente) : null,
    emisor_nit: data.emisor_nit ? String(data.emisor_nit) : null,
    emisor_nrc: data.emisor_nrc ? String(data.emisor_nrc) : null,
    emisor_nombre: data.emisor_nombre ? String(data.emisor_nombre) : null,
    receptor_nit: data.receptor_nit ? String(data.receptor_nit) : null,
    receptor_nrc: data.receptor_nrc ? String(data.receptor_nrc) : null,
    monto_total:
      data.monto_total === null || data.monto_total === undefined
        ? null
        : Number(data.monto_total),
    iva: data.iva === null || data.iva === undefined ? null : Number(data.iva),
    sello_recepcion: data.sello_recepcion ? String(data.sello_recepcion) : null,
    related_codigos: asStringArray(data.related_codigos),
    created_at: asIso(data.created_at) || new Date().toISOString(),
    linked_count: Number(data.linked_count || 0),
    json_data: data.json_data,
  };
}

async function firstByQuery(
  organizationId: string,
  field: string,
  value: string
): Promise<FirebaseGmailDocumentRow | null> {
  const snapshot = await documentsCollection(organizationId)
    .where(field, '==', value)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return mapDocumentSnapshot(snapshot.docs[0]);
}

export async function findDocumentByMessageAttachment(
  organizationId: string,
  messageId: string,
  attachmentId: string
) {
  const snapshot = await documentsCollection(organizationId)
    .where('message_attachment_key', '==', `${messageId}:${attachmentId}`)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return mapDocumentSnapshot(snapshot.docs[0]);
}

export async function findDocumentByHash(organizationId: string, contentHash: string) {
  return firstByQuery(organizationId, 'content_hash', contentHash);
}

export async function recordDocument(input: RecordDocumentInput) {
  const meta = parsedToDocumentFields(input.parsed);
  const jsonData = parseJsonBuffer(input.buffer);
  const storagePath = `firestore://organizations/${input.organizationId}/gmail_documents/${input.documentId}`;

  const row = {
    organization_id: input.organizationId,
    connection_id: input.connectionId,
    sync_job_id: input.syncJobId,
    gmail_message_id: input.ref.messageId,
    message_attachment_key: `${input.ref.messageId}:${input.ref.attachmentId}`,
    gmail_thread_id: input.ref.threadId || null,
    gmail_attachment_id: input.ref.attachmentId,
    gmail_snippet: input.ref.snippet || null,
    gmail_internal_date: input.ref.internalDate || null,
    content_hash: input.contentHash,
    file_name: input.ref.fileName,
    storage_path: storagePath,
    file_size_bytes: input.fileSize,
    email_subject: input.ref.emailSubject || null,
    email_date: input.ref.emailDate || null,
    email_from: input.ref.emailFrom || null,
    email_from_name: input.ref.emailFromName || null,
    email_to: input.ref.emailTo || [],
    email_cc: input.ref.emailCc || [],
    import_status: input.importStatus,
    json_data: jsonData,
    updated_at: FieldValue.serverTimestamp(),
    created_at: FieldValue.serverTimestamp(),
    ...meta,
  };

  await documentsCollection(input.organizationId).doc(input.documentId).set(row);
  const snapshot = await documentsCollection(input.organizationId)
    .doc(input.documentId)
    .get();
  return mapDocumentSnapshot(snapshot);
}

export async function getDocumentById(documentId: string, organizationId: string) {
  const snapshot = await documentsCollection(organizationId).doc(documentId).get();
  if (!snapshot.exists) return null;
  return mapDocumentSnapshot(snapshot);
}

export async function listDocuments(input: {
  organizationId: string;
  syncJobId?: string;
  importStatus?: string;
  tipoDte?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const snapshot = await documentsCollection(input.organizationId)
    .orderBy('email_date', 'desc')
    .limit(500)
    .get();

  let rows = snapshot.docs.map(mapDocumentSnapshot);

  if (input.syncJobId) rows = rows.filter((row) => row.sync_job_id === input.syncJobId);
  if (input.importStatus) rows = rows.filter((row) => row.import_status === input.importStatus);
  if (input.tipoDte) rows = rows.filter((row) => row.tipo_dte === input.tipoDte);
  if (input.dateFrom) rows = rows.filter((row) => (row.fec_emi || '') >= input.dateFrom!);
  if (input.dateTo) rows = rows.filter((row) => (row.fec_emi || '') <= input.dateTo!);

  const q = input.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((row) =>
      [
        row.codigo_generacion,
        row.emisor_nit,
        row.emisor_nrc,
        row.emisor_nombre,
        row.numero_control,
        row.email_subject,
        row.email_from,
        row.file_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }

  const total = rows.length;
  const offset = input.offset ?? 0;
  const limit = input.limit ?? 50;
  return {
    documents: rows.slice(offset, offset + limit).map(({ json_data, ...row }) => row),
    total,
  };
}

export async function getDocumentsByIds(organizationId: string, ids: string[]) {
  const documents: FirebaseGmailDocumentRow[] = [];
  for (const id of ids) {
    const doc = await getDocumentById(id, organizationId);
    if (doc) documents.push(doc);
  }
  return documents;
}

export async function downloadDocumentJson(documentId: string, organizationId: string) {
  const doc = await getDocumentById(documentId, organizationId);
  if (!doc?.json_data) return null;
  return Buffer.from(JSON.stringify(doc.json_data, null, 2), 'utf8');
}

export async function getLinkedDocuments(
  documentId: string,
  organizationId: string
): Promise<{ links: GmailDocumentLinkRow[]; documents: GmailDocumentRow[] }> {
  const snapshot = await linksCollection(organizationId)
    .where('document_ids', 'array-contains', documentId)
    .get();

  const links = snapshot.docs.map((doc) => {
    const data = doc.data() as JsonRecord;
    return {
      id: doc.id,
      organization_id: organizationId,
      source_document_id: String(data.source_document_id || ''),
      target_document_id: String(data.target_document_id || ''),
      link_type: String(data.link_type || 'json_reference') as GmailDocumentLinkRow['link_type'],
      created_at: asIso(data.created_at) || new Date().toISOString(),
    };
  });

  const relatedIds = new Set<string>();
  links.forEach((link) => {
    relatedIds.add(
      link.source_document_id === documentId
        ? link.target_document_id
        : link.source_document_id
    );
  });

  const documents: GmailDocumentRow[] = [];
  for (const id of relatedIds) {
    const doc = await getDocumentById(id, organizationId);
    if (doc) documents.push(doc);
  }

  return { links, documents };
}
