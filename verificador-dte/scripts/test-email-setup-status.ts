/**
 * Prueba checks de setup IMAP via Postgres (sin secret key REST).
 * Uso: pnpm exec tsx scripts/test-email-setup-status.ts
 */
import { loadRepoEnv } from './load-repo-env';

loadRepoEnv();

async function main() {
  const { getEmailIntegrationSetupStatus } = await import('../lib/email/setup-status');
  const status = await getEmailIntegrationSetupStatus({ organizationLinked: true });
  console.log('ready:', status.ready);
  console.log('project:', status.supabaseProjectRef);
  for (const check of status.checks) {
    console.log(`${check.ok ? 'OK' : 'FAIL'} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
