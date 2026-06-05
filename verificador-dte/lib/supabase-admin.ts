import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export const GENERIC_SERVICE_ERROR_MESSAGE =
  'No se pudo completar la solicitud. Intenta nuevamente en unos momentos.';

export function getPublicServiceErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');

  if (message === 'No autorizado') return message;
  if (message.includes('Sin organizacion')) return 'Sin organizacion.';

  return GENERIC_SERVICE_ERROR_MESSAGE;
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    console.error(
      '[supabase:init] Missing Supabase config values',
      {
        hasUrl: Boolean(url),
        hasServiceRoleKey: Boolean(serviceKey),
      }
    );
    throw new Error(GENERIC_SERVICE_ERROR_MESSAGE);
  }

  if (adminClient && cachedUrl === url && cachedKey === serviceKey) {
    return adminClient;
  }

  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  cachedUrl = url;
  cachedKey = serviceKey;

  return adminClient;
}

export const GMAIL_STORAGE_BUCKET = 'client-documents';

export type GmailConnectionRow = {
  id: string;
  organization_id: string;
  google_email: string;
  refresh_token_enc: string;
  access_token: string | null;
  token_expires_at: string | null;
  connected_by_uid: string;
  scopes: string[];
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

export type GmailSyncJobRow = {
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

export type GmailDocumentImportStatus =
  | 'imported'
  | 'skipped_duplicate'
  | 'skipped_date'
  | 'skipped_invalid'
  | 'skipped_unsupported_type';

export type GmailDocumentLinkType =
  | 'nc_to_invoice'
  | 'nd_to_invoice'
  | 'json_reference';

export type GmailDocumentRow = {
  id: string;
  organization_id: string;
  connection_id: string;
  sync_job_id: string | null;
  gmail_message_id: string;
  gmail_attachment_id: string;
  content_hash: string;
  file_name: string;
  storage_path: string | null;
  file_size_bytes: number;
  codigo_generacion: string | null;
  fec_emi: string | null;
  email_subject: string | null;
  email_date: string | null;
  import_status: GmailDocumentImportStatus;
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
};

export type GmailDocumentLinkRow = {
  id: string;
  organization_id: string;
  source_document_id: string;
  target_document_id: string;
  link_type: GmailDocumentLinkType;
  created_at: string;
};
