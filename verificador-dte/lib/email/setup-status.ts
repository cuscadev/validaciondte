import {
  EMAIL_STORAGE_BUCKET,
  extractSupabaseProjectRef,
  resolveSupabaseServiceKey,
} from '@/lib/supabase-admin';
import {
  columnExistsViaPg,
  storageBucketExistsViaPg,
  tableExistsViaPg,
} from '@/lib/email/pg-setup-check';

export type EmailSetupCheckId =
  | 'organization'
  | 'supabase_url'
  | 'supabase_service_key'
  | 'supabase_project_alignment'
  | 'supabase_rest'
  | 'encryption_key'
  | 'microsoft_oauth_configured'
  | 'table_email_connections'
  | 'table_email_sync_jobs'
  | 'table_email_documents'
  | 'table_email_document_links'
  | 'column_json_content'
  | 'storage_bucket';

export type EmailSetupCheck = {
  id: EmailSetupCheckId;
  label: string;
  ok: boolean;
  detail?: string;
  /** Solo visible para superadmin (variables de servidor). */
  adminOnly?: boolean;
};

export type EmailIntegrationSetupStatus = {
  ready: boolean;
  checks: EmailSetupCheck[];
  supabaseProjectRef: string | null;
};

const REQUIRED_TABLES = [
  'email_connections',
  'email_sync_jobs',
  'email_documents',
  'email_document_links',
] as const;

const SECRET_KEY_HELP =
  'Dashboard > Settings > API Keys > Secret keys (sb_secret_...) del mismo proyecto que NEXT_PUBLIC_SUPABASE_URL.';

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

async function tableExists(tableName: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const { error } = await getSupabaseAdmin()
      .from(tableName)
      .select('id')
      .limit(0);

    if (error) {
      return { ok: false, detail: error.message };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error comprobando tabla';
    if (message.includes('fetch failed') || message.includes('ENOTFOUND')) {
      return tableExistsViaPg(tableName);
    }
    return { ok: false, detail: message };
  }
}

async function storageBucketExists(): Promise<{ ok: boolean; detail?: string }> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const { data, error } = await getSupabaseAdmin().storage.listBuckets();
    if (error) {
      return { ok: false, detail: error.message };
    }
    const exists = (data || []).some((bucket) => bucket.name === EMAIL_STORAGE_BUCKET);
    return exists
      ? { ok: true }
      : {
          ok: false,
          detail: `Falta el bucket "${EMAIL_STORAGE_BUCKET}". Ejecuta supabase/SETUP_FROM_ZERO.sql en el SQL Editor.`,
        };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error comprobando storage';
    if (message.includes('fetch failed') || message.includes('ENOTFOUND')) {
      return storageBucketExistsViaPg();
    }
    return { ok: false, detail: message };
  }
}

export async function getEmailIntegrationSetupStatus(input?: {
  organizationLinked?: boolean;
}): Promise<EmailIntegrationSetupStatus> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = resolveSupabaseServiceKey();
  const dbUrl = process.env.SUPABASE_DB_URL?.trim();
  const encryptionKey =
    process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY?.trim() ||
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();

  const urlRef = extractSupabaseProjectRef(supabaseUrl);
  const dbRef = extractSupabaseProjectRefFromDbUrl(dbUrl);
  const jwtRef = serviceKey ? extractJwtProjectRef(serviceKey) : null;
  const projectAligned =
    Boolean(urlRef) &&
    (!dbRef || urlRef === dbRef) &&
    (!jwtRef || urlRef === jwtRef);

  const checks: EmailSetupCheck[] = [
    {
      id: 'organization',
      label: 'Organizacion vinculada a tu usuario',
      ok: Boolean(input?.organizationLinked),
      detail: input?.organizationLinked
        ? undefined
        : 'Completa el onboarding o pide al administrador que te asigne una organizacion.',
    },
    {
      id: 'supabase_url',
      label: 'NEXT_PUBLIC_SUPABASE_URL',
      ok: Boolean(supabaseUrl),
      adminOnly: true,
      detail: supabaseUrl ? undefined : 'Define la URL del proyecto Supabase en .env.local (raiz del repo)',
    },
    {
      id: 'supabase_service_key',
      label: 'SUPABASE_SERVICE_ROLE_KEY',
      ok: Boolean(serviceKey),
      adminOnly: true,
      detail: serviceKey ? undefined : SECRET_KEY_HELP,
    },
    {
      id: 'supabase_project_alignment',
      label: 'Proyecto Supabase alineado (URL, secret key y DB)',
      ok: projectAligned,
      adminOnly: true,
      detail: projectAligned
        ? undefined
        : `URL=${urlRef || '?'}, DB=${dbRef || '?'}, JWT=${jwtRef || 'sb_secret_*'}. Usa el mismo project ref en las tres variables. ${SECRET_KEY_HELP}`,
    },
    {
      id: 'supabase_rest',
      label: 'Servidor Supabase operativo (REST / secret key)',
      ok: Boolean(serviceKey && projectAligned),
      detail:
        serviceKey && projectAligned
          ? undefined
          : `Pega la Secret key en SUPABASE_SERVICE_ROLE_KEY. ${SECRET_KEY_HELP}`,
    },
    {
      id: 'encryption_key',
      label: 'EMAIL_CREDENTIALS_ENCRYPTION_KEY',
      ok: Boolean(encryptionKey),
      adminOnly: true,
      detail: encryptionKey
        ? undefined
        : 'Genera una clave base64 de 32 bytes y agregala a .env.local (raiz del repo)',
    },
    {
      id: 'microsoft_oauth_configured',
      label: 'MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET (OAuth IMAP, opcional)',
      ok: Boolean(
        process.env.MICROSOFT_CLIENT_ID?.trim() &&
          process.env.MICROSOFT_CLIENT_SECRET?.trim()
      ),
      adminOnly: true,
      detail:
        process.env.MICROSOFT_CLIENT_ID?.trim() &&
        process.env.MICROSOFT_CLIENT_SECRET?.trim()
          ? undefined
          : 'Opcional. Solo necesario si conectas Outlook con OAuth2 en lugar de contraseña de aplicacion IMAP.',
    },
  ];

  const canCheckDatabase =
    Boolean(supabaseUrl && serviceKey && projectAligned) || Boolean(dbUrl);

  if (canCheckDatabase) {
    for (const tableName of REQUIRED_TABLES) {
      const result =
        serviceKey && projectAligned
          ? await tableExists(tableName)
          : await tableExistsViaPg(tableName);
      checks.push({
        id: `table_${tableName}` as EmailSetupCheckId,
        label: `Tabla public.${tableName}`,
        ok: result.ok,
        detail: result.ok
          ? undefined
          : result.detail ||
            'Ejecuta supabase/SETUP_FROM_ZERO.sql en el SQL Editor de Supabase.',
      });
    }

    const jsonColumn =
      serviceKey && projectAligned
        ? await columnExistsViaPg('email_documents', 'json_content')
        : await columnExistsViaPg('email_documents', 'json_content');
    checks.push({
      id: 'column_json_content',
      label: 'Columna email_documents.json_content',
      ok: jsonColumn.ok,
      detail: jsonColumn.ok
        ? undefined
        : jsonColumn.detail ||
          'Ejecuta supabase/migrations/005_email_json_content_jsonb.sql en el SQL Editor.',
    });

    const bucket =
      serviceKey && projectAligned
        ? await storageBucketExists()
        : await storageBucketExistsViaPg();
    checks.push({
      id: 'storage_bucket',
      label: `Bucket de storage "${EMAIL_STORAGE_BUCKET}" (opcional, solo legacy)`,
      ok: true,
      detail: bucket.ok
        ? undefined
        : 'No existe el bucket; los documentos nuevos se guardan como texto en la base. Solo afecta imports antiguos.',
    });
  } else {
    for (const tableName of REQUIRED_TABLES) {
      checks.push({
        id: `table_${tableName}` as EmailSetupCheckId,
        label: `Tabla public.${tableName}`,
        ok: false,
        detail: 'Configura Supabase en el servidor antes de crear las tablas.',
      });
    }
    checks.push({
      id: 'column_json_content',
      label: 'Columna email_documents.json_content',
      ok: false,
      detail: 'Configura Supabase en el servidor antes de agregar json_content.',
    });
    checks.push({
      id: 'storage_bucket',
      label: `Bucket de storage "${EMAIL_STORAGE_BUCKET}" (opcional, solo legacy)`,
      ok: true,
      detail: 'Configura Supabase en el servidor. Los documentos nuevos no requieren bucket.',
    });
  }

  const blockingChecks = checks.filter((check) => !check.adminOnly);
  const ready = blockingChecks.every((check) => check.ok);

  return {
    ready,
    checks,
    supabaseProjectRef: urlRef,
  };
}
