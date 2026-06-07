// Sincroniza emisores y relaciones usuario_emisor desde Firestore -> PostgreSQL.
//
// Ejecutar desde verificador-dte:
//   pnpm exec tsx scripts/sync-firebase-emitters-to-postgres.ts --dry-run
//   pnpm sync:emitters:postgres
//
// Estrategia:
// - Crea/actualiza emisores para usuarios/organizaciones con NIT valido de 14 digitos.
// - Relaciona el propietario con rol propietario.
// - Relaciona colaboradores cuyo organizationId/cliente apunte al propietario con rol editor.
// - Si falta NRC, genera uno temporal NDT{ultimos 10 del NIT}; luego debe completarse.

import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

type FirebaseUser = {
  uid: string;
  email: string;
  role: string;
  nombre: string;
  organizationId: string;
  cliente: string;
  nit: string;
  nrc: string;
  telefono: string;
  correo: string;
};

type FirebaseOrg = {
  id: string;
  ownerUid: string;
  nit: string;
  nrc: string;
  nombre: string;
  telefono: string;
  correo: string;
  departamentoCodigo: string;
  municipioCodigo: string;
  distritoCodigo: string;
  complementoDireccion: string;
  codigoActividad: string;
  descripcionActividad: string;
};

type EmitterCandidate = {
  ownerUid: string;
  nit: string;
  nrc: string;
  nombre: string;
  correo: string;
  telefono: string;
  departamentoCodigo: string | null;
  municipioCodigo: string | null;
  distritoCodigo: string | null;
  complementoDireccion: string | null;
  codigoActividad: string | null;
  descripcionActividad: string | null;
  temporaryNrc: boolean;
};

const dryRun = process.argv.includes('--dry-run');

function databaseURL() {
  const explicit = process.env.DATABASE_URL || process.env.FACTURACION_DATABASE_URL;
  if (explicit) return explicit;

  const goEnvPath = resolve(process.cwd(), '..', 'go-dte-api', '.env');
  if (existsSync(goEnvPath)) {
    const raw = readFileSync(goEnvPath, 'utf8');
    const match = raw.match(/^DATABASE_URL=(.+)$/m);
    if (match?.[1]) return match[1].trim().replace(/^"|"$/g, '');
  }

  return 'postgres://facturacion:facturacion123@localhost:5433/facturacion?sslmode=disable';
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

function digits(value: unknown) {
  return firstString(value).replace(/\D/g, '');
}

function validNit(value: string) {
  return /^\d{14}$/.test(value);
}

function nullable(value: string) {
  return value.trim() || null;
}

function temporaryNrc(nit: string) {
  return `NDT${nit.slice(-10)}`;
}

function userFromDoc(doc: QueryDocumentSnapshot): FirebaseUser {
  const data = asRecord(doc.data());
  const hacienda = asRecord(data.hacienda);
  const kyc = asRecord(data.kyc);

  return {
    uid: doc.id,
    email: firstString(data.email),
    role: firstString(data.role).toLowerCase(),
    nombre: firstString(data.displayName, data.nombre, data.cliente, data.name, data.email, doc.id),
    organizationId: firstString(data.organizationId, data.orgId),
    cliente: firstString(data.cliente),
    nit: digits(data.nit) || digits(hacienda.nit) || digits(kyc.nit) || digits(kyc.taxId),
    nrc: digits(data.nrc) || digits(hacienda.nrc) || digits(kyc.nrc),
    telefono: firstString(data.phoneNumber, data.telefono, kyc.phone, kyc.telefono),
    correo: firstString(data.email),
  };
}

function orgFromDoc(doc: QueryDocumentSnapshot): FirebaseOrg {
  const data = asRecord(doc.data());
  const kyc = asRecord(data.kyc);
  const address = asRecord(kyc.address);

  return {
    id: doc.id,
    ownerUid: firstString(data.ownerUid, doc.id),
    nit: digits(data.nit) || digits(kyc.nit) || digits(kyc.taxId) || digits(kyc.documentNumber),
    nrc: digits(data.nrc) || digits(kyc.nrc),
    nombre: firstString(kyc.fullLegalName, data.name, data.legalName, doc.id),
    telefono: firstString(kyc.phone, kyc.telefono, data.phone),
    correo: firstString(data.ownerEmail, data.email),
    departamentoCodigo: firstString(kyc.departmentCode, kyc.departamento, address.departamento),
    municipioCodigo: firstString(kyc.municipalityCode, kyc.municipio, address.municipio),
    distritoCodigo: firstString(kyc.districtCode, kyc.distrito, address.distrito),
    complementoDireccion: firstString(kyc.addressComplement, kyc.complementoDireccion, address.complemento),
    codigoActividad: firstString(kyc.activityCode, kyc.codigoActividad),
    descripcionActividad: firstString(kyc.activityDescription, kyc.descripcionActividad),
  };
}

function buildCandidates(users: FirebaseUser[], orgs: FirebaseOrg[]) {
  const usersByUid = new Map(users.map((user) => [user.uid, user]));
  const candidates = new Map<string, EmitterCandidate>();

  for (const org of orgs) {
    if (!validNit(org.nit)) continue;
    const owner = usersByUid.get(org.ownerUid);
    const nrc = org.nrc || owner?.nrc || temporaryNrc(org.nit);
    candidates.set(org.ownerUid, {
      ownerUid: org.ownerUid,
      nit: org.nit,
      nrc,
      nombre: org.nombre || owner?.nombre || org.ownerUid,
      correo: org.correo || owner?.correo || '',
      telefono: org.telefono || owner?.telefono || '',
      departamentoCodigo: nullable(org.departamentoCodigo),
      municipioCodigo: nullable(org.municipioCodigo),
      distritoCodigo: nullable(org.distritoCodigo),
      complementoDireccion: nullable(org.complementoDireccion),
      codigoActividad: nullable(org.codigoActividad),
      descripcionActividad: nullable(org.descripcionActividad),
      temporaryNrc: !org.nrc && !owner?.nrc,
    });
  }

  for (const user of users) {
    if (!validNit(user.nit) || candidates.has(user.uid)) continue;
    const nrc = user.nrc || temporaryNrc(user.nit);
    candidates.set(user.uid, {
      ownerUid: user.uid,
      nit: user.nit,
      nrc,
      nombre: user.nombre,
      correo: user.correo,
      telefono: user.telefono,
      departamentoCodigo: null,
      municipioCodigo: null,
      distritoCodigo: null,
      complementoDireccion: null,
      codigoActividad: null,
      descripcionActividad: null,
      temporaryNrc: !user.nrc,
    });
  }

  return [...candidates.values()];
}

async function readUsersAndOrgs() {
  const { adminDb } = await import('../lib/firebase-admin');
  const [usersSnap, orgsSnap] = await Promise.all([
    adminDb.collection('users').get(),
    adminDb.collection('organizations').get(),
  ]);

  return {
    users: usersSnap.docs.map(userFromDoc),
    orgs: orgsSnap.docs.map(orgFromDoc),
  };
}

async function getUserIds(client: Client) {
  const result = await client.query<{ id: number; firebase_uid: string }>(
    'SELECT id, firebase_uid FROM usuarios'
  );
  return new Map(result.rows.map((row) => [row.firebase_uid, row.id]));
}

async function upsertEmitter(client: Client, candidate: EmitterCandidate, ownerUserId: number) {
  const result = await client.query<{ id: number }>(
    `
      INSERT INTO emisores (
        nit,
        nrc,
        nombre,
        nombre_comercial,
        razon_social,
        codigo_actividad,
        descripcion_actividad,
        departamento_codigo,
        municipio_codigo,
        distrito_codigo,
        complemento_direccion,
        telefono,
        correo,
        certificado_path,
        usuario_id,
        activo,
        ambiente_codigo,
        updated_at
      )
      VALUES (
        $1, $2, $3, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE, '00', CURRENT_TIMESTAMP
      )
      ON CONFLICT (nit)
      DO UPDATE SET
        nrc = EXCLUDED.nrc,
        nombre = EXCLUDED.nombre,
        nombre_comercial = EXCLUDED.nombre_comercial,
        razon_social = EXCLUDED.razon_social,
        codigo_actividad = EXCLUDED.codigo_actividad,
        descripcion_actividad = EXCLUDED.descripcion_actividad,
        departamento_codigo = EXCLUDED.departamento_codigo,
        municipio_codigo = EXCLUDED.municipio_codigo,
        distrito_codigo = EXCLUDED.distrito_codigo,
        complemento_direccion = EXCLUDED.complemento_direccion,
        telefono = EXCLUDED.telefono,
        correo = EXCLUDED.correo,
        certificado_path = EXCLUDED.certificado_path,
        usuario_id = EXCLUDED.usuario_id,
        activo = TRUE,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `,
    [
      candidate.nit,
      candidate.nrc,
      candidate.nombre,
      candidate.codigoActividad,
      candidate.descripcionActividad,
      candidate.departamentoCodigo,
      candidate.municipioCodigo,
      candidate.distritoCodigo,
      candidate.complementoDireccion,
      candidate.telefono,
      candidate.correo,
      `Ejemplodeceritifcado/${candidate.nit}.crt`,
      ownerUserId,
    ]
  );
  return result.rows[0].id;
}

async function upsertRelation(client: Client, usuarioId: number, emisorId: number, rol: string) {
  await client.query(
    `
      INSERT INTO usuario_emisor (usuario_id, emisor_id, rol)
      VALUES ($1, $2, $3)
      ON CONFLICT (usuario_id, emisor_id)
      DO UPDATE SET rol = EXCLUDED.rol
    `,
    [usuarioId, emisorId, rol]
  );
}

function relatedUsers(ownerUid: string, users: FirebaseUser[]) {
  return users.filter((user) => {
    if (user.uid === ownerUid) return true;
    return user.organizationId === ownerUid || user.cliente === ownerUid;
  });
}

async function syncEmitters() {
  const { users, orgs } = await readUsersAndOrgs();
  const candidates = buildCandidates(users, orgs);

  console.log(dryRun ? 'Modo dry-run: no se escribira en PostgreSQL.' : 'Sincronizando emisores...');
  console.log(`Candidatos de emisor con NIT valido: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('No hay emisores con NIT de 14 digitos para sincronizar.');
    return;
  }

  const client = new Client({ connectionString: databaseURL() });
  if (!dryRun) await client.connect();

  let emittersSynced = 0;
  let relationsSynced = 0;
  let skipped = 0;

  try {
    const userIds = dryRun ? new Map<string, number>() : await getUserIds(client);

    for (const candidate of candidates) {
      const relations = relatedUsers(candidate.ownerUid, users);

      if (dryRun) {
        console.log('[dry-run emisor]', {
          ownerUid: candidate.ownerUid,
          nit: candidate.nit,
          nrc: candidate.nrc,
          temporaryNrc: candidate.temporaryNrc,
          nombre: candidate.nombre,
          relations: relations.map((user) => ({
            uid: user.uid,
            email: user.email,
            rol: user.uid === candidate.ownerUid ? 'propietario' : 'editor',
          })),
        });
        emittersSynced += 1;
        relationsSynced += relations.length;
        continue;
      }

      const ownerUserId = userIds.get(candidate.ownerUid);
      if (!ownerUserId) {
        console.warn(`[skip] propietario no existe en tabla usuarios: ${candidate.ownerUid}`);
        skipped += 1;
        continue;
      }

      const emisorId = await upsertEmitter(client, candidate, ownerUserId);
      emittersSynced += 1;

      for (const user of relations) {
        const usuarioId = userIds.get(user.uid);
        if (!usuarioId) continue;
        await upsertRelation(
          client,
          usuarioId,
          emisorId,
          user.uid === candidate.ownerUid ? 'propietario' : 'editor'
        );
        relationsSynced += 1;
      }
    }
  } finally {
    if (!dryRun) await client.end();
  }

  console.log('Sincronizacion terminada.');
  console.log(`  Emisores: ${emittersSynced}`);
  console.log(`  Relaciones usuario_emisor: ${relationsSynced}`);
  console.log(`  Omitidos: ${skipped}`);
}

syncEmitters().catch((error) => {
  console.error('Error sincronizando emisores:', error);
  process.exit(1);
});
