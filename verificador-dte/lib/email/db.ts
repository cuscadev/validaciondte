import {
  EMAIL_STORAGE_BUCKET,
  getSupabaseAdmin,
  type EmailConnectionRow,
  type EmailDocumentLinkRow,
  type EmailDocumentLinkType,
  type EmailDocumentRow,
  type EmailProvider,
  type EmailSyncJobRow,
  type EmailSyncJobResultRow,
} from '@/lib/supabase-admin';
import { encryptSecret } from '@/lib/email/credentials-crypto';
import type { ParsedDteImport } from '@/lib/gmail/parse-dte-import';

export type DocumentInsertInput = Omit<EmailDocumentRow, 'id' | 'created_at' | 'linked_count'>;

function normalizeJsonContent(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return JSON.stringify(raw);
  const text = String(raw).trim();
  return text || null;
}

function mapDocumentRow(row: Record<string, unknown>): EmailDocumentRow {
  const related = row.related_codigos;
  const jsonContent = normalizeJsonContent(row.json_content);
  const hasJsonContent =
    jsonContent != null ||
    Boolean(row.storage_path) ||
    row.import_status === 'imported';
  return {
    ...(row as unknown as EmailDocumentRow),
    related_codigos: Array.isArray(related) ? related.map(String) : [],
    monto_total:
      row.monto_total === null || row.monto_total === undefined
        ? null
        : Number(row.monto_total),
    iva: row.iva === null || row.iva === undefined ? null : Number(row.iva),
    message_id_header: (row.message_id_header as string | null) ?? null,
    mailbox_folder: (row.mailbox_folder as string) || 'INBOX',
    json_content: jsonContent,
    has_json_content: hasJsonContent,
  };
}

/** Columnas listadas sin json_content (evita transferir payloads grandes). has_json_content se deriva en mapDocumentRow. */
const DOCUMENT_LIST_SELECT =
  'id, organization_id, connection_id, sync_job_id, message_uid, attachment_part_id, message_id_header, mailbox_folder, content_hash, file_name, storage_path, file_size_bytes, codigo_generacion, fec_emi, email_subject, email_date, import_status, tipo_dte, tipo_dte_label, numero_control, ambiente, emisor_nit, emisor_nrc, emisor_nombre, receptor_nit, receptor_nrc, monto_total, iva, sello_recepcion, related_codigos, created_at';

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

export async function listConnections(
  organizationId: string
): Promise<EmailConnectionRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('email_connections')
    .select('*')
    .eq('organization_id', organizationId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as EmailConnectionRow[];
}

export async function getConnectionById(
  connectionId: string,
  organizationId: string
): Promise<EmailConnectionRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('email_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('organization_id', organizationId)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as EmailConnectionRow | null;
}

export async function insertConnection(input: {
  organizationId: string;
  provider: EmailProvider;
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  mailboxFolder: string;
  secret: string;
  authMethod: 'app_password' | 'oauth2';
  connectedByUid: string;
}): Promise<EmailConnectionRow> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('email_connections')
    .insert({
      organization_id: input.organizationId,
      provider: input.provider,
      email_address: input.emailAddress,
      imap_host: input.imapHost,
      imap_port: input.imapPort,
      imap_secure: input.imapSecure,
      mailbox_folder: input.mailboxFolder,
      password_enc: encryptSecret(input.secret),
      auth_method: input.authMethod,
      connected_by_uid: input.connectedByUid,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as EmailConnectionRow;
}

export async function revokeConnectionById(
  connectionId: string,
  organizationId: string
) {
  const { error } = await getSupabaseAdmin()
    .from('email_connections')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', connectionId)
    .eq('organization_id', organizationId)
    .is('revoked_at', null);

  if (error) throw new Error(error.message);
}

export async function createSyncJob(input: {
  organizationId: string;
  connectionId: string;
  dateFrom: string;
  dateTo: string;
  createdByUid: string;
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('email_sync_jobs')
    .insert({
      organization_id: input.organizationId,
      connection_id: input.connectionId,
      date_from: input.dateFrom,
      date_to: input.dateTo,
      status: 'running',
      created_by_uid: input.createdByUid,
      started_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as EmailSyncJobRow;
}

export async function getSyncJob(
  jobId: string,
  organizationId: string
): Promise<EmailSyncJobRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('email_sync_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as EmailSyncJobRow | null;
}

export async function listSyncJobResults(
  syncJobId: string,
  organizationId: string
): Promise<EmailSyncJobResultRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('email_sync_job_results')
    .select('*')
    .eq('sync_job_id', syncJobId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as EmailSyncJobResultRow[];
}

const DEFAULT_SYNC_WAIT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_SYNC_WAIT_POLL_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForSyncJobCompletion(
  jobId: string,
  organizationId: string,
  options?: { timeoutMs?: number; pollIntervalMs?: number }
): Promise<{ job: EmailSyncJobRow; results: EmailSyncJobResultRow[] }> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_SYNC_WAIT_TIMEOUT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_SYNC_WAIT_POLL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await getSyncJob(jobId, organizationId);
    if (!job) {
      throw new Error('Trabajo de sincronizacion no encontrado.');
    }
    if (job.status === 'completed' || job.status === 'failed') {
      if (job.status === 'failed') {
        throw new Error(job.error_message || 'La extraccion fallo en el servidor.');
      }
      const results = await listSyncJobResults(jobId, organizationId);
      return { job, results };
    }
    await sleep(pollIntervalMs);
  }

  throw new Error('Tiempo de espera agotado esperando la extraccion en el servidor.');
}

export async function updateSyncJob(jobId: string, patch: Partial<EmailSyncJobRow>) {
  const { error } = await getSupabaseAdmin()
    .from('email_sync_jobs')
    .update(patch)
    .eq('id', jobId);

  if (error) throw new Error(error.message);
}

export async function findDocumentByMessageAttachment(input: {
  connectionId: string;
  mailboxFolder: string;
  messageUid: string;
  attachmentPartId: string;
}): Promise<EmailDocumentRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('email_documents')
    .select('*')
    .eq('connection_id', input.connectionId)
    .eq('mailbox_folder', input.mailboxFolder)
    .eq('message_uid', input.messageUid)
    .eq('attachment_part_id', input.attachmentPartId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapDocumentRow(data as Record<string, unknown>) : null;
}

export async function findDocumentByHash(
  organizationId: string,
  contentHash: string
): Promise<EmailDocumentRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('email_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('content_hash', contentHash)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapDocumentRow(data as Record<string, unknown>) : null;
}

export async function getDocumentById(
  documentId: string,
  organizationId: string
): Promise<EmailDocumentRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('email_documents')
    .select('*')
    .eq('id', documentId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapDocumentRow(data as Record<string, unknown>) : null;
}

export async function findImportedDocumentsByCodigos(
  organizationId: string,
  codigos: string[]
): Promise<EmailDocumentRow[]> {
  if (!codigos.length) return [];
  const { data, error } = await getSupabaseAdmin()
    .from('email_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('import_status', 'imported')
    .in('codigo_generacion', codigos);

  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapDocumentRow(row as Record<string, unknown>));
}

export async function listImportedDocumentsForOrg(
  organizationId: string
): Promise<EmailDocumentRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('email_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('import_status', 'imported');

  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapDocumentRow(row as Record<string, unknown>));
}

export async function insertDocument(row: DocumentInsertInput): Promise<EmailDocumentRow> {
  const { data, error } = await getSupabaseAdmin()
    .from('email_documents')
    .insert(row)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapDocumentRow(data as Record<string, unknown>);
}

export async function recordDocument(input: {
  organizationId: string;
  connectionId: string;
  syncJobId: string;
  ref: {
    messageUid: string;
    attachmentPartId: string;
    messageIdHeader: string;
    mailboxFolder: string;
    fileName: string;
    emailSubject: string;
    emailDate: string;
  };
  contentHash: string;
  fileSize: number;
  parsed: ParsedDteImport | null;
  importStatus: EmailDocumentRow['import_status'];
  storagePath: string | null;
  jsonContent?: string | null;
}) {
  if (input.importStatus === 'imported') {
    if (!input.jsonContent?.trim()) {
      throw new Error('Los documentos importados requieren json_content en la base de datos.');
    }
    if (input.storagePath) {
      throw new Error('Los documentos importados no deben usar storage_path.');
    }
  }

  const meta = parsedToDocumentFields(input.parsed);
  const row = await insertDocument({
    organization_id: input.organizationId,
    connection_id: input.connectionId,
    sync_job_id: input.syncJobId,
    message_uid: input.ref.messageUid,
    attachment_part_id: input.ref.attachmentPartId,
    message_id_header: input.ref.messageIdHeader || null,
    mailbox_folder: input.ref.mailboxFolder,
    content_hash: input.contentHash,
    file_name: input.ref.fileName,
    storage_path: input.storagePath,
    json_content: input.jsonContent ?? null,
    file_size_bytes: input.fileSize,
    email_subject: input.ref.emailSubject,
    email_date: input.ref.emailDate,
    import_status: input.importStatus,
    ...meta,
  });

  if (input.importStatus === 'imported' && !row.json_content?.trim()) {
    throw new Error(
      'No se guardo json_content. Ejecuta supabase/migrations/005_email_json_content_jsonb.sql en Supabase.'
    );
  }

  return row;
}

export async function getDocumentJsonBuffer(
  document: EmailDocumentRow
): Promise<Buffer> {
  if (document.json_content) {
    return Buffer.from(document.json_content, 'utf-8');
  }
  if (document.storage_path) {
    return downloadDocumentFromStorage(document.storage_path);
  }
  throw new Error('El documento no tiene contenido JSON disponible.');
}

export function documentHasJsonContent(document: EmailDocumentRow): boolean {
  if (document.has_json_content) return true;
  if (document.json_content?.trim()) return true;
  if (document.storage_path) return true;
  return document.import_status === 'imported';
}

/** @deprecated Solo documentos legacy en Storage. IMAP guarda json_content. */
export async function uploadDocumentToStorage(
  organizationId: string,
  documentId: string,
  buffer: Buffer
): Promise<string> {
  const storagePath = `${organizationId}/${documentId}.json`;
  const { error } = await getSupabaseAdmin()
    .storage.from(EMAIL_STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'application/json',
      upsert: false,
    });

  if (error) throw new Error(error.message);
  return storagePath;
}

export async function createSignedJsonUrl(storagePath: string, expiresIn = 3600) {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(EMAIL_STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function downloadDocumentFromStorage(storagePath: string) {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(EMAIL_STORAGE_BUCKET)
    .download(storagePath);

  if (error) throw new Error(error.message);
  return Buffer.from(await data.arrayBuffer());
}

export async function listDocuments(input: {
  organizationId: string;
  connectionId?: string;
  syncJobId?: string;
  importStatus?: string;
  tipoDte?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  let query = getSupabaseAdmin()
    .from('email_documents')
    .select(DOCUMENT_LIST_SELECT, { count: 'exact' })
    .eq('organization_id', input.organizationId)
    .order('fec_emi', { ascending: false, nullsFirst: false });

  if (input.connectionId) query = query.eq('connection_id', input.connectionId);
  if (input.syncJobId) query = query.eq('sync_job_id', input.syncJobId);
  if (input.importStatus) query = query.eq('import_status', input.importStatus);
  if (input.tipoDte) query = query.eq('tipo_dte', input.tipoDte);
  if (input.dateFrom) query = query.gte('fec_emi', input.dateFrom);
  if (input.dateTo) query = query.lte('fec_emi', input.dateTo);

  const q = input.q?.trim();
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, '')}%`;
    query = query.or(
      [
        `codigo_generacion.ilike.${pattern}`,
        `emisor_nit.ilike.${pattern}`,
        `emisor_nrc.ilike.${pattern}`,
        `emisor_nombre.ilike.${pattern}`,
        `numero_control.ilike.${pattern}`,
        `email_subject.ilike.${pattern}`,
        `file_name.ilike.${pattern}`,
      ].join(',')
    );
  }

  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  const documents = (data || []).map((row) =>
    mapDocumentRow(row as Record<string, unknown>)
  );
  const withCounts = await attachLinkedCounts(documents);
  return { documents: withCounts, total: count ?? 0 };
}

async function attachLinkedCounts(documents: EmailDocumentRow[]) {
  if (!documents.length) return documents;
  const ids = documents.map((d) => d.id);
  const { data, error } = await getSupabaseAdmin()
    .from('email_document_links')
    .select('source_document_id, target_document_id')
    .in('source_document_id', ids);

  if (error) return documents;

  const outbound = new Map<string, number>();
  const inbound = new Map<string, number>();
  for (const row of data || []) {
    outbound.set(
      row.source_document_id,
      (outbound.get(row.source_document_id) || 0) + 1
    );
    inbound.set(
      row.target_document_id,
      (inbound.get(row.target_document_id) || 0) + 1
    );
  }

  return documents.map((doc) => ({
    ...doc,
    linked_count: (outbound.get(doc.id) || 0) + (inbound.get(doc.id) || 0),
  }));
}

export async function upsertDocumentLink(input: {
  organizationId: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  linkType: EmailDocumentLinkType;
}) {
  const { error } = await getSupabaseAdmin()
    .from('email_document_links')
    .upsert(
      {
        organization_id: input.organizationId,
        source_document_id: input.sourceDocumentId,
        target_document_id: input.targetDocumentId,
        link_type: input.linkType,
      },
      { onConflict: 'source_document_id,target_document_id,link_type' }
    );

  if (error) throw new Error(error.message);
}

export async function listDocumentLinks(documentId: string, organizationId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('email_document_links')
    .select('*')
    .eq('organization_id', organizationId)
    .or(`source_document_id.eq.${documentId},target_document_id.eq.${documentId}`);

  if (error) throw new Error(error.message);
  return (data || []) as EmailDocumentLinkRow[];
}

export async function getLinkedDocuments(documentId: string, organizationId: string) {
  const links = await listDocumentLinks(documentId, organizationId);
  const relatedIds = new Set<string>();
  for (const link of links) {
    relatedIds.add(
      link.source_document_id === documentId
        ? link.target_document_id
        : link.source_document_id
    );
  }
  if (!relatedIds.size) return { links, documents: [] as EmailDocumentRow[] };

  const { data, error } = await getSupabaseAdmin()
    .from('email_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .in('id', Array.from(relatedIds));

  if (error) throw new Error(error.message);
  return {
    links,
    documents: (data || []).map((row) =>
      mapDocumentRow(row as Record<string, unknown>)
    ),
  };
}

export async function getDocumentsByIds(
  organizationId: string,
  ids: string[]
): Promise<EmailDocumentRow[]> {
  if (!ids.length) return [];
  const { data, error } = await getSupabaseAdmin()
    .from('email_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .in('id', ids);

  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapDocumentRow(row as Record<string, unknown>));
}

export async function getLastSyncJob(
  organizationId: string,
  connectionId?: string
) {
  let query = getSupabaseAdmin()
    .from('email_sync_jobs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (connectionId) query = query.eq('connection_id', connectionId);

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  return data as EmailSyncJobRow | null;
}
