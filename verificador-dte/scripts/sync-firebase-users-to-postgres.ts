// Sincroniza Firestore users -> PostgreSQL usuarios.
//
// Ejecutar desde verificador-dte:
//   pnpm exec tsx scripts/sync-firebase-users-to-postgres.ts
//
// Opciones:
//   --dry-run                  Solo muestra lo que sincronizaria
//   SYNC_USERS_LIMIT=100       Limita cantidad de usuarios
//   SUPABASE_DB_URL=postgresql://...   (misma URL que go-dte-api/.env)

import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import { resolve } from 'path';

import { getFacturacionDatabaseUrl } from '../lib/facturacion-database-url';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

type UserRow = {
  firebaseUid: string;
  email: string;
  nombre: string | null;
  rol: string;
  activo: boolean;
};

const dryRun = process.argv.includes('--dry-run');
const limit = Number(process.env.SYNC_USERS_LIMIT || 0);
const batchSize = Number(process.env.SYNC_USERS_BATCH_SIZE || 250);

function databaseURL() {
  return getFacturacionDatabaseUrl();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function normalizeRole(value: unknown) {
  const role = firstString(value).toLowerCase();
  if (role === 'superadmin' || role === 'admin' || role === 'cliente' || role === 'colaborador') {
    return role;
  }
  return 'cliente';
}

async function mapUser(
  doc: QueryDocumentSnapshot,
  adminAuth: typeof import('../lib/firebase-admin').adminAuth
): Promise<UserRow | null> {
  const data = asRecord(doc.data());
  const uid = doc.id;

  let authUser: Awaited<ReturnType<typeof adminAuth.getUser>> | null = null;
  const needsAuthFallback =
    !firstString(data.email) ||
    !firstString(data.displayName, data.nombre, data.cliente, data.name);

  if (needsAuthFallback) {
    try {
      authUser = await adminAuth.getUser(uid);
    } catch {
      authUser = null;
    }
  }

  const email = firstString(data.email, authUser?.email);
  if (!email) {
    console.warn(`[skip] ${uid}: sin email`);
    return null;
  }

  const nombre =
    firstString(
      data.displayName,
      data.nombre,
      data.cliente,
      data.name,
      authUser?.displayName,
      email.split('@')[0]
    ) || null;

  const activo =
    data.disabled === true ||
    data.accountStatus === 'disabled' ||
    data.accountStatus === 'blocked' ||
    authUser?.disabled === true
      ? false
      : true;

  return {
    firebaseUid: uid,
    email: email.toLowerCase(),
    nombre,
    rol: normalizeRole(data.role),
    activo,
  };
}

async function upsertUser(client: Client, row: UserRow) {
  await client.query(
    `
      INSERT INTO usuarios (
        firebase_uid,
        email,
        nombre,
        rol,
        activo,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (firebase_uid)
      DO UPDATE SET
        email = EXCLUDED.email,
        nombre = EXCLUDED.nombre,
        rol = EXCLUDED.rol,
        activo = EXCLUDED.activo,
        updated_at = CURRENT_TIMESTAMP
    `,
    [row.firebaseUid, row.email, row.nombre, row.rol, row.activo]
  );
}

async function syncUsers() {
  const { adminAuth, adminDb } = await import('../lib/firebase-admin');
  const pg = new Client({ connectionString: databaseURL() });

  if (!dryRun) {
    await pg.connect();
  }

  let lastDoc: QueryDocumentSnapshot | null = null;
  let scanned = 0;
  let synced = 0;
  let skipped = 0;

  console.log(dryRun ? 'Modo dry-run: no se escribira en PostgreSQL.' : 'Sincronizando usuarios...');

  try {
    for (;;) {
      let query = adminDb
        .collection('users')
        .orderBy('__name__')
        .limit(Math.min(batchSize, limit > 0 ? Math.max(limit - scanned, 1) : batchSize));

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snap = await query.get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        if (limit > 0 && scanned >= limit) break;
        scanned += 1;

        const row = await mapUser(doc, adminAuth);
        if (!row) {
          skipped += 1;
          continue;
        }

        if (dryRun) {
          console.log('[dry-run]', row);
        } else {
          await upsertUser(pg, row);
        }
        synced += 1;
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (limit > 0 && scanned >= limit) break;
      if (snap.size < batchSize) break;
    }

    console.log('Sincronizacion terminada.');
    console.log(`  Leidos: ${scanned}`);
    console.log(`  Sincronizados: ${synced}`);
    console.log(`  Omitidos: ${skipped}`);
  } finally {
    if (!dryRun) {
      await pg.end();
    }
  }
}

syncUsers().catch((error) => {
  console.error('Error sincronizando usuarios:', error);
  process.exit(1);
});
