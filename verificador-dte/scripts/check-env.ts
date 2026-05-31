import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

const requiredPublic = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

function hasAdminCredentials() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json && json !== '{}') return true;

  return Boolean(
    process.env.FIREBASE_PROJECT_ID?.trim() &&
      process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
      process.env.FIREBASE_PRIVATE_KEY?.trim()
  );
}

function main() {
  const missing = requiredPublic.filter((key) => !process.env[key]?.trim());
  const issues: string[] = [];

  if (missing.length > 0) {
    issues.push(`Firebase cliente: ${missing.join(', ')}`);
  }

  if (!hasAdminCredentials()) {
    issues.push(
      'Firebase Admin: define FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY'
    );
  }

  if (!process.env.JWT_SECRET?.trim()) {
    issues.push('JWT_SECRET');
  }

  if (issues.length > 0) {
    console.error('Faltan variables en .env.local:');
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
    console.error('\nCopia .env.example a .env.local y completa los valores de Firebase.');
    process.exit(1);
  }

  console.log('Variables de entorno OK para desarrollo local.');
  console.log('Siguiente paso: npm run setup:admin');
}

main();
