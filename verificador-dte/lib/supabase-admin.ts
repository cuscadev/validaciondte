import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export function extractSupabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const ref = host.split('.')[0];
    return ref || null;
  } catch {
    return null;
  }
}

function extractSupabaseProjectRefFromDbUrl(dbUrl: string | undefined): string | null {
  if (!dbUrl) return null;
  try {
    const host = new URL(dbUrl.replace(/^postgres(ql)?:\/\//, 'http://')).hostname;
    const match = host.match(/^db\.([^.]+)\.supabase\.co$/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function extractJwtProjectRef(key: string): string | null {
  if (!key.startsWith('eyJ')) return null;
  try {
    const payload = key.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      ref?: string;
    };
    return decoded.ref?.trim() || null;
  } catch {
    return null;
  }
}

export function resolveSupabaseServiceKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    ''
  );
}

export function validateSupabaseEnv(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = resolveSupabaseServiceKey();
  const dbUrl = process.env.SUPABASE_DB_URL?.trim();

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase no configurado: define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (sb_secret_... o service_role JWT del mismo proyecto).'
    );
  }

  const urlRef = extractSupabaseProjectRef(url);
  const dbRef = extractSupabaseProjectRefFromDbUrl(dbUrl);
  const jwtRef = extractJwtProjectRef(serviceKey);

  if (urlRef && dbRef && urlRef !== dbRef) {
    throw new Error(
      `Supabase desalineado: NEXT_PUBLIC_SUPABASE_URL usa ${urlRef} pero SUPABASE_DB_URL usa ${dbRef}.`
    );
  }

  if (urlRef && jwtRef && urlRef !== jwtRef) {
    throw new Error(
      `Supabase desalineado: NEXT_PUBLIC_SUPABASE_URL usa ${urlRef} pero la service key JWT pertenece a ${jwtRef}. Copia la Secret key del proyecto correcto en Dashboard > Settings > API Keys.`
    );
  }
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = resolveSupabaseServiceKey();

  validateSupabaseEnv();

  if (adminClient && cachedUrl === url && cachedKey === serviceKey) {
    return adminClient;
  }

  adminClient = createClient(url!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  cachedUrl = url;
  cachedKey = serviceKey;

  return adminClient;
}

export const EMAIL_STORAGE_BUCKET = 'client-documents';

/** @deprecated use EMAIL_STORAGE_BUCKET */
export const GMAIL_STORAGE_BUCKET = EMAIL_STORAGE_BUCKET;

export type EmailProvider = 'gmail' | 'yahoo' | 'microsoft';

export type EmailAuthMethod = 'app_password' | 'oauth2';

export type EmailConnectionRow = {
  id: string;
  organization_id: string;
  provider: EmailProvider;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  mailbox_folder: string;
  password_enc: string;
  auth_method: EmailAuthMethod;
  connected_by_uid: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

export type EmailSyncJobRow = {
  id: string;
  organization_id: string;
  connection_id: string;
  date_from: string;
  date_to: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  found_count: number;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  cursor: string | null;
  error_message: string | null;
  created_by_uid: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type EmailDocumentImportStatus =
  | 'imported'
  | 'skipped_duplicate'
  | 'skipped_date'
  | 'skipped_invalid'
  | 'skipped_unsupported_type';

export type EmailDocumentLinkType =
  | 'nc_to_invoice'
  | 'nd_to_invoice'
  | 'json_reference';

export type EmailDocumentRow = {
  id: string;
  organization_id: string;
  connection_id: string;
  sync_job_id: string | null;
  message_uid: string;
  attachment_part_id: string;
  message_id_header: string | null;
  mailbox_folder: string;
  content_hash: string;
  file_name: string;
  storage_path: string | null;
  json_content: string | null;
  file_size_bytes: number;
  codigo_generacion: string | null;
  fec_emi: string | null;
  email_subject: string | null;
  email_date: string | null;
  import_status: EmailDocumentImportStatus;
  tipo_dte: string | null;
  tipo_dte_label: string | null;
  numero_control: string | null;
  ambiente: string | null;
  emisor_nit: string | null;
  emisor_nrc: string | null;
  emisor_nombre: string | null;
  receptor_nit: string | null;
  receptor_nrc: string | null;
  monto_total: number | null;
  iva: number | null;
  sello_recepcion: string | null;
  related_codigos: string[];
  created_at: string;
  linked_count?: number;
  /** Derivado en listados sin cargar json_content completo. */
  has_json_content?: boolean;
};

export type EmailDocumentLinkRow = {
  id: string;
  organization_id: string;
  source_document_id: string;
  target_document_id: string;
  link_type: EmailDocumentLinkType;
  created_at: string;
};

export type EmailSyncJobResultRow = {
  id: string;
  sync_job_id: string;
  organization_id: string;
  document_id: string | null;
  message_uid: string;
  attachment_part_id: string;
  file_name: string | null;
  email_subject: string | null;
  email_date: string | null;
  import_status: EmailDocumentImportStatus;
  codigo_generacion: string | null;
  tipo_dte: string | null;
  tipo_dte_label: string | null;
  fec_emi: string | null;
  emisor_nombre: string | null;
  created_at: string;
};

/** Legacy aliases */
export type GmailConnectionRow = EmailConnectionRow;
export type GmailSyncJobRow = EmailSyncJobRow;
export type GmailDocumentImportStatus = EmailDocumentImportStatus;
export type GmailDocumentLinkType = EmailDocumentLinkType;
export type GmailDocumentRow = EmailDocumentRow;
export type GmailDocumentLinkRow = EmailDocumentLinkRow;
