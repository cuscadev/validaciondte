import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase-admin';
import { encryptImapSecret } from '@/lib/imap/credentials-crypto';
import type { ImapConnectionRow } from '@/lib/imap/types';

type JsonRecord = Record<string, unknown>;

function connectionsCollection() {
  return adminDb.collection('imap_connections');
}

function asIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function nowIso() {
  return new Date().toISOString();
}

function mapConnectionSnapshot(
  snapshot: FirebaseFirestore.DocumentSnapshot
): ImapConnectionRow {
  const data = (snapshot.data() || {}) as JsonRecord;
  return {
    id: snapshot.id,
    organization_id: String(data.organization_id || snapshot.id),
    email: String(data.email || ''),
    host: String(data.host || ''),
    port: Number(data.port || 993),
    secure: data.secure !== false,
    provider: String(data.provider || 'custom'),
    password_enc: String(data.password_enc || ''),
    connected_by_uid: String(data.connected_by_uid || ''),
    consent_accepted_at: asIso(data.consent_accepted_at),
    consent_accepted_by_uid: data.consent_accepted_by_uid
      ? String(data.consent_accepted_by_uid)
      : null,
    created_at: asIso(data.created_at) || nowIso(),
    updated_at: asIso(data.updated_at) || nowIso(),
    revoked_at: asIso(data.revoked_at),
  };
}

export async function getActiveImapConnection(
  organizationId: string
): Promise<ImapConnectionRow | null> {
  const snapshot = await connectionsCollection().doc(organizationId).get();
  if (!snapshot.exists) return null;
  const connection = mapConnectionSnapshot(snapshot);
  return connection.revoked_at ? null : connection;
}

export async function upsertImapConnection(input: {
  organizationId: string;
  email: string;
  host: string;
  port: number;
  secure: boolean;
  provider: string;
  password: string;
  connectedByUid: string;
}): Promise<ImapConnectionRow> {
  const now = FieldValue.serverTimestamp();
  const ref = connectionsCollection().doc(input.organizationId);
  await ref.set(
    {
      organization_id: input.organizationId,
      email: input.email,
      host: input.host,
      port: input.port,
      secure: input.secure,
      provider: input.provider,
      password_enc: encryptImapSecret(input.password),
      connected_by_uid: input.connectedByUid,
      consent_accepted_at: now,
      consent_accepted_by_uid: input.connectedByUid,
      updated_at: now,
      created_at: now,
      revoked_at: null,
    },
    { merge: true }
  );
  return mapConnectionSnapshot(await ref.get());
}

export async function revokeImapConnection(organizationId: string) {
  await connectionsCollection().doc(organizationId).set(
    {
      password_enc: '',
      revoked_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
