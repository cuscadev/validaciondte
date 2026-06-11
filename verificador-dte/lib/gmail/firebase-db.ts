import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { adminDb, adminStorage } from '@/lib/firebase-admin';
import type { GmailAttachmentRef } from '@/lib/gmail/client';
import type { ParsedDteImport } from '@/lib/gmail/parse-dte-import';
import { GMAIL_SCOPES } from '@/lib/gmail/oauth';
import { encryptSecret } from '@/lib/gmail/token-crypto';
import type {
  GmailConnectionRow,
  GmailDocumentImportStatus,
  GmailDocumentLinkRow,
  GmailDocumentRow,
  GmailSyncJobRow,
} from '@/lib/gmail/types';

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

function connectionsCollection() {
  return adminDb.collection('gmail_connections');
}

function jobsCollection(organizationId: string) {
  return adminDb
    .collection('organizations')
    .doc(organizationId)
    .collection('gmail_sync_jobs');
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

function nowIso() {
  return new Date().toISOString();
}

function mapConnectionSnapshot(
  snapshot: FirebaseFirestore.DocumentSnapshot
): GmailConnectionRow {
  const data = (snapshot.data() || {}) as JsonRecord;
  return {
    id: snapshot.id,
    organization_id: String(data.organization_id || snapshot.id),
    google_email: String(data.google_email || ''),
    refresh_token_enc: String(data.refresh_token_enc || ''),
    access_token: data.access_token ? String(data.access_token) : null,
    token_expires_at: asIso(data.token_expires_at),
    connected_by_uid: String(data.connected_by_uid || ''),
    scopes: asStringArray(data.scopes),
    created_at: asIso(data.created_at) || nowIso(),
    updated_at: asIso(data.updated_at) || nowIso(),
    revoked_at: asIso(data.revoked_at),
  };
}

function mapJobSnapshot(snapshot: FirebaseFirestore.DocumentSnapshot): GmailSyncJobRow {
  const data = (snapshot.data() || {}) as JsonRecord;
  return {
    id: snapshot.id,
    organization_id: String(data.organization_id || ''),
    connection_id: String(data.connection_id || ''),
    date_from: String(data.date_from || ''),
    date_to: String(data.date_to || ''),
    status: String(data.status || 'running') as GmailSyncJobRow['status'],
    found_count: Number(data.found_count || 0),
    imported_count: Number(data.imported_count || 0),
    skipped_count: Number(data.skipped_count || 0),
    error_count: Number(data.error_count || 0),
    cursor: data.cursor ? String(data.cursor) : null,
    error_message: data.error_message ? String(data.error_message) : null,
    created_by_uid: String(data.created_by_uid || ''),
    created_at: asIso(data.created_at) || nowIso(),
    started_at: asIso(data.started_at),
    finished_at: asIso(data.finished_at),
  };
}

export async function getActiveConnection(
  organizationId: string
): Promise<GmailConnectionRow | null> {
  const snapshot = await connectionsCollection().doc(organizationId).get();
  if (!snapshot.exists) return null;
  const connection = mapConnectionSnapshot(snapshot);
  return connection.revoked_at ? null : connection;
}

export async function upsertConnection(input: {
  organizationId: string;
  googleEmail: string;
  refreshToken: string;
  accessToken?: string | null;
  tokenExpiresAt?: Date | null;
  connectedByUid: string;
}) {
  const now = FieldValue.serverTimestamp();
  const ref = connectionsCollection().doc(input.organizationId);
  await ref.set(
    {
      organization_id: input.organizationId,
      google_email: input.googleEmail,
      refresh_token_enc: encryptSecret(input.refreshToken),
      access_token: input.accessToken ?? null,
      token_expires_at: input.tokenExpiresAt?.toISOString() ?? null,
      connected_by_uid: input.connectedByUid,
      scopes: GMAIL_SCOPES,
      updated_at: now,
      created_at: now,
      revoked_at: null,
    },
    { merge: true }
  );
  return mapConnectionSnapshot(await ref.get());
}

export async function updateConnectionAfterOAuth(input: {
  organizationId: string;
  googleEmail: string;
  accessToken?: string | null;
  tokenExpiresAt?: Date | null;
  connectedByUid: string;
}) {
  await connectionsCollection().doc(input.organizationId).set(
    {
      google_email: input.googleEmail,
      access_token: input.accessToken ?? null,
      token_expires_at: input.tokenExpiresAt?.toISOString() ?? null,
      connected_by_uid: input.connectedByUid,
      updated_at: FieldValue.serverTimestamp(),
      revoked_at: null,
    },
    { merge: true }
  );
}

export async function updateConnectionTokens(
  connectionId: string,
  accessToken: string,
  tokenExpiresAt: Date | null
) {
  await connectionsCollection().doc(connectionId).set(
    {
      access_token: accessToken,
      token_expires_at: tokenExpiresAt?.toISOString() ?? null,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function revokeConnection(organizationId: string) {
  await connectionsCollection().doc(organizationId).set(
    {
      revoked_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createSyncJob(input: {
  organizationId: string;
  connectionId: string;
  dateFrom: string;
  dateTo: string;
  createdByUid: string;
}) {
  const ref = jobsCollection(input.organizationId).doc();
  await ref.set({
    organization_id: input.organizationId,
    connection_id: input.connectionId,
    date_from: input.dateFrom,
    date_to: input.dateTo,
    status: 'running',
    found_count: 0,
    imported_count: 0,
    skipped_count: 0,
    error_count: 0,
    cursor: null,
    error_message: null,
    created_by_uid: input.createdByUid,
    created_at: FieldValue.serverTimestamp(),
    started_at: FieldValue.serverTimestamp(),
    finished_at: null,
  });
  return mapJobSnapshot(await ref.get());
}

export async function getSyncJob(
  jobId: string,
  organizationId: string
): Promise<GmailSyncJobRow | null> {
  const snapshot = await jobsCollection(organizationId).doc(jobId).get();
  if (!snapshot.exists) return null;
  return mapJobSnapshot(snapshot);
}

export async function updateSyncJob(
  organizationId: string,
  jobId: string,
  patch: Partial<GmailSyncJobRow>
) {
  await jobsCollection(organizationId).doc(jobId).set(
    {
      ...patch,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getLastSyncJob(organizationId: string) {
  const snapshot = await jobsCollection(organizationId)
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return mapJobSnapshot(snapshot.docs[0]);
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
  const storagePath = `gmail/${input.organizationId}/${input.documentId}.json`;
  await adminStorage.bucket().file(storagePath).save(input.buffer, {
    contentType: 'application/json; charset=utf-8',
    resumable: false,
    metadata: {
      cacheControl: 'private, max-age=0, no-transform',
    },
  });

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
    json_preview: jsonData && typeof jsonData === 'object' ? jsonData : null,
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

export async function listImportedDocumentsForOrg(
  organizationId: string
): Promise<GmailDocumentRow[]> {
  const snapshot = await documentsCollection(organizationId)
    .where('import_status', '==', 'imported')
    .get();

  return snapshot.docs.map((doc) => {
    const { json_data, ...row } = mapDocumentSnapshot(doc);
    return row;
  });
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
  if (!doc?.storage_path) return null;
  const [buffer] = await adminStorage.bucket().file(doc.storage_path).download();
  return buffer;
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

export async function upsertDocumentLink(input: {
  organizationId: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  linkType: GmailDocumentLinkRow['link_type'];
}) {
  const id = `${input.sourceDocumentId}_${input.targetDocumentId}_${input.linkType}`;
  await linksCollection(input.organizationId).doc(id).set(
    {
      organization_id: input.organizationId,
      source_document_id: input.sourceDocumentId,
      target_document_id: input.targetDocumentId,
      document_ids: [input.sourceDocumentId, input.targetDocumentId],
      link_type: input.linkType,
      created_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
