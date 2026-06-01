import {
  GMAIL_STORAGE_BUCKET,
  getSupabaseAdmin,
  type GmailConnectionRow,
  type GmailDocumentLinkRow,
  type GmailDocumentLinkType,
  type GmailDocumentRow,
  type GmailSyncJobRow,
} from '@/lib/supabase-admin';
import type { ParsedDteImport } from '@/lib/gmail/parse-dte-import';
import { encryptSecret } from '@/lib/gmail/token-crypto';
import { GMAIL_SCOPES } from '@/lib/gmail/oauth';

export type DocumentInsertInput = Omit<GmailDocumentRow, 'id' | 'created_at' | 'linked_count'>;

function mapDocumentRow(row: Record<string, unknown>): GmailDocumentRow {
  const related = row.related_codigos;
  return {
    ...(row as unknown as GmailDocumentRow),
    related_codigos: Array.isArray(related)
      ? related.map(String)
      : [],
    monto_total:
      row.monto_total === null || row.monto_total === undefined
        ? null
        : Number(row.monto_total),
    iva:
      row.iva === null || row.iva === undefined ? null : Number(row.iva),
  };
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

export async function getActiveConnection(
  organizationId: string
): Promise<GmailConnectionRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('google_gmail_connections')
    .select('*')
    .eq('organization_id', organizationId)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as GmailConnectionRow | null;
}

export async function upsertConnection(input: {
  organizationId: string;
  googleEmail: string;
  refreshToken: string;
  accessToken?: string | null;
  tokenExpiresAt?: Date | null;
  connectedByUid: string;
}) {
  const now = new Date().toISOString();
  const row = {
    organization_id: input.organizationId,
    google_email: input.googleEmail,
    refresh_token_enc: encryptSecret(input.refreshToken),
    access_token: input.accessToken ?? null,
    token_expires_at: input.tokenExpiresAt?.toISOString() ?? null,
    connected_by_uid: input.connectedByUid,
    scopes: GMAIL_SCOPES,
    updated_at: now,
    revoked_at: null,
  };

  const { data, error } = await getSupabaseAdmin()
    .from('google_gmail_connections')
    .upsert(row, { onConflict: 'organization_id' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as GmailConnectionRow;
}

export async function updateConnectionAfterOAuth(input: {
  organizationId: string;
  googleEmail: string;
  accessToken?: string | null;
  tokenExpiresAt?: Date | null;
  connectedByUid: string;
}) {
  const { error } = await getSupabaseAdmin()
    .from('google_gmail_connections')
    .update({
      google_email: input.googleEmail,
      access_token: input.accessToken ?? null,
      token_expires_at: input.tokenExpiresAt?.toISOString() ?? null,
      connected_by_uid: input.connectedByUid,
      updated_at: new Date().toISOString(),
      revoked_at: null,
    })
    .eq('organization_id', input.organizationId)
    .is('revoked_at', null);

  if (error) throw new Error(error.message);
}

export async function revokeConnection(organizationId: string) {
  const { error } = await getSupabaseAdmin()
    .from('google_gmail_connections')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
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
    .from('gmail_sync_jobs')
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
  return data as GmailSyncJobRow;
}

export async function getSyncJob(
  jobId: string,
  organizationId: string
): Promise<GmailSyncJobRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('gmail_sync_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as GmailSyncJobRow | null;
}

export async function updateSyncJob(
  jobId: string,
  patch: Partial<GmailSyncJobRow>
) {
  const { error } = await getSupabaseAdmin()
    .from('gmail_sync_jobs')
    .update(patch)
    .eq('id', jobId);

  if (error) throw new Error(error.message);
}

export async function findDocumentByMessageAttachment(
  messageId: string,
  attachmentId: string
): Promise<GmailDocumentRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('gmail_documents')
    .select('*')
    .eq('gmail_message_id', messageId)
    .eq('gmail_attachment_id', attachmentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapDocumentRow(data as Record<string, unknown>) : null;
}

export async function findDocumentByHash(
  organizationId: string,
  contentHash: string
): Promise<GmailDocumentRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('gmail_documents')
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
): Promise<GmailDocumentRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('gmail_documents')
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
): Promise<GmailDocumentRow[]> {
  if (!codigos.length) return [];
  const { data, error } = await getSupabaseAdmin()
    .from('gmail_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('import_status', 'imported')
    .in('codigo_generacion', codigos);

  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapDocumentRow(row as Record<string, unknown>));
}

export async function listImportedDocumentsForOrg(
  organizationId: string
): Promise<GmailDocumentRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('gmail_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('import_status', 'imported');

  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapDocumentRow(row as Record<string, unknown>));
}

export async function insertDocument(
  row: DocumentInsertInput
): Promise<GmailDocumentRow> {
  const { data, error } = await getSupabaseAdmin()
    .from('gmail_documents')
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
    messageId: string;
    attachmentId: string;
    fileName: string;
    emailSubject: string;
    emailDate: string;
  };
  contentHash: string;
  fileSize: number;
  parsed: ParsedDteImport | null;
  importStatus: GmailDocumentRow['import_status'];
  storagePath: string | null;
}) {
  const meta = parsedToDocumentFields(input.parsed);
  return insertDocument({
    organization_id: input.organizationId,
    connection_id: input.connectionId,
    sync_job_id: input.syncJobId,
    gmail_message_id: input.ref.messageId,
    gmail_attachment_id: input.ref.attachmentId,
    content_hash: input.contentHash,
    file_name: input.ref.fileName,
    storage_path: input.storagePath,
    file_size_bytes: input.fileSize,
    email_subject: input.ref.emailSubject,
    email_date: input.ref.emailDate,
    import_status: input.importStatus,
    ...meta,
  });
}

export async function uploadDocumentToStorage(
  organizationId: string,
  documentId: string,
  buffer: Buffer
): Promise<string> {
  const storagePath = `${organizationId}/${documentId}.json`;
  const { error } = await getSupabaseAdmin()
    .storage.from(GMAIL_STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'application/json',
      upsert: false,
    });

  if (error) throw new Error(error.message);
  return storagePath;
}

export async function createSignedJsonUrl(storagePath: string, expiresIn = 3600) {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(GMAIL_STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function downloadDocumentFromStorage(storagePath: string) {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(GMAIL_STORAGE_BUCKET)
    .download(storagePath);

  if (error) throw new Error(error.message);
  return Buffer.from(await data.arrayBuffer());
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
  let query = getSupabaseAdmin()
    .from('gmail_documents')
    .select('*', { count: 'exact' })
    .eq('organization_id', input.organizationId)
    .order('fec_emi', { ascending: false, nullsFirst: false });

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

async function attachLinkedCounts(documents: GmailDocumentRow[]) {
  if (!documents.length) return documents;
  const ids = documents.map((d) => d.id);
  const { data, error } = await getSupabaseAdmin()
    .from('gmail_document_links')
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
  linkType: GmailDocumentLinkType;
}) {
  const { error } = await getSupabaseAdmin()
    .from('gmail_document_links')
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

export async function listDocumentLinks(
  documentId: string,
  organizationId: string
) {
  const { data, error } = await getSupabaseAdmin()
    .from('gmail_document_links')
    .select('*')
    .eq('organization_id', organizationId)
    .or(`source_document_id.eq.${documentId},target_document_id.eq.${documentId}`);

  if (error) throw new Error(error.message);
  return (data || []) as GmailDocumentLinkRow[];
}

export async function getLinkedDocuments(
  documentId: string,
  organizationId: string
) {
  const links = await listDocumentLinks(documentId, organizationId);
  const relatedIds = new Set<string>();
  for (const link of links) {
    relatedIds.add(
      link.source_document_id === documentId
        ? link.target_document_id
        : link.source_document_id
    );
  }
  if (!relatedIds.size) return { links, documents: [] as GmailDocumentRow[] };

  const { data, error } = await getSupabaseAdmin()
    .from('gmail_documents')
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
): Promise<GmailDocumentRow[]> {
  if (!ids.length) return [];
  const { data, error } = await getSupabaseAdmin()
    .from('gmail_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .in('id', ids);

  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapDocumentRow(row as Record<string, unknown>));
}

export async function getLastSyncJob(organizationId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('gmail_sync_jobs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as GmailSyncJobRow | null;
}
