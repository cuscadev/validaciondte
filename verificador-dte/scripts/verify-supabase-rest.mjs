/**
 * Verifica conectividad REST de Supabase con variables de .env.local (raiz del repo).
 * Uso: pnpm run verify:supabase
 */
import { createClient } from '@supabase/supabase-js';
import { loadRepoEnv } from '../../scripts/load-env.mjs';

loadRepoEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || !key) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local (raiz del repo).'
  );
  process.exit(1);
}

const refFromUrl = new URL(url).hostname.split('.')[0];
let refFromKey = '';
try {
  const payload = key.startsWith('eyJ') ? key.split('.')[1] : '';
  if (payload) {
    refFromKey = JSON.parse(Buffer.from(payload, 'base64url').toString()).ref || '';
  }
} catch {
  // sb_secret_* keys have no JWT ref
}

if (refFromKey && refFromUrl && refFromKey !== refFromUrl) {
  console.error(
    `Proyecto desalineado: URL=${refFromUrl} pero service key JWT ref=${refFromKey}`
  );
  process.exit(1);
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tables = [
  'email_connections',
  'email_sync_jobs',
  'email_documents',
  'email_document_links',
];

for (const table of tables) {
  const { error } = await client.from(table).select('id').limit(0);
  if (error) {
    console.error(`FAIL ${table}:`, error.message);
    process.exit(1);
  }
  console.log(`OK ${table}`);
}

const { data: buckets, error: bucketError } = await client.storage.listBuckets();
if (bucketError) {
  console.error('FAIL storage:', bucketError.message);
  process.exit(1);
}

const hasBucket = (buckets || []).some((b) => b.name === 'client-documents');
console.log(hasBucket ? 'OK bucket client-documents' : 'FAIL bucket client-documents missing');

if (!hasBucket) process.exit(1);
console.log('Supabase REST listo para IMAP.');
