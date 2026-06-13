// Copia inicial de usuarios Firestore → Postgres (app_users) vía go-dte-api.
// Ejecutar: npx tsx scripts/sync-users-to-postgres.ts
//
// Requisitos:
//   - go-dte-api corriendo con SUPABASE_DB_URL
//   - GO_DTE_INTERNAL_API_KEY (si está configurada en la API)
//   - Credenciales Firebase Admin en .env.local

import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

async function main() {
  const { adminAuth, adminDb } = await import('../lib/firebase-admin');
  const { bulkSyncAppUsersToPostgres, mapFirestoreUserToSyncPayload } = await import(
    '../lib/server-user-sync'
  );

  const snap = await adminDb.collection('users').get();
  console.log(`Usuarios en Firestore: ${snap.size}`);

  const users = await Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data();
      let disabled = data.disabled === true || data.active === false;

      try {
        const authUser = await adminAuth.getUser(doc.id);
        disabled = authUser.disabled;
      } catch {
        // Perfil Firestore sin cuenta Auth; se sincroniza con disabled del doc.
      }

      return mapFirestoreUserToSyncPayload({
        uid: doc.id,
        ...data,
        disabled,
      });
    })
  );

  const validUsers = users.filter((user) => user !== null);
  const skipped = snap.size - validUsers.length;
  if (skipped > 0) {
    console.warn(`Omitidos por falta de id/email: ${skipped}`);
  }

  if (validUsers.length === 0) {
    console.log('Nada que sincronizar.');
    return;
  }

  const batchSize = 100;
  let totalUpserted = 0;
  const allErrors: string[] = [];

  for (let i = 0; i < validUsers.length; i += batchSize) {
    const batch = validUsers.slice(i, i + batchSize);
    const result = await bulkSyncAppUsersToPostgres(
      batch.map((user) => ({
        uid: user!.id,
        email: user!.email,
        role: user!.role,
        organizationId: user!.organizationId ?? undefined,
        orgRole: user!.orgRole ?? undefined,
        accountStatus: user!.accountStatus,
        displayName: user!.displayName ?? undefined,
        disabled: user!.disabled,
        membership: {
          type: (user!.membershipType ?? 'free') as 'free' | 'premium' | 'pro',
          expiresAt: user!.membershipExpiresAt ?? '',
        },
      }))
    );

    totalUpserted += result.upserted;
    allErrors.push(...(result.errors ?? []));
    console.log(
      `Lote ${Math.floor(i / batchSize) + 1}: ${result.upserted}/${batch.length} upserted`
    );
  }

  console.log('\nResumen:');
  console.log(`  Total Firestore: ${snap.size}`);
  console.log(`  Válidos:         ${validUsers.length}`);
  console.log(`  Upserted:        ${totalUpserted}`);
  console.log(`  Errores:         ${allErrors.length}`);

  if (allErrors.length > 0) {
    console.log('\nErrores:');
    for (const err of allErrors.slice(0, 20)) {
      console.log(`  - ${err}`);
    }
    if (allErrors.length > 20) {
      console.log(`  ... y ${allErrors.length - 20} más`);
    }
    process.exitCode = 1;
  }

  console.log('\nSiguiente paso: verificar huérfanos antes de activar la FK:');
  console.log(`
select distinct firebase_user_id
from email_documents
where firebase_user_id is not null
  and firebase_user_id not in (select id from app_users);
`);
}

main().catch((error) => {
  console.error('Error en backfill de usuarios:', error);
  process.exitCode = 1;
});
