import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase-admin';
import { GMAIL_SCOPES } from '@/lib/gmail/oauth';
import { encryptSecret } from '@/lib/gmail/token-crypto';
import type {
  DteImportSource,
  GmailConnectionRow,
  GmailSyncJobRow,
} from '@/lib/gmail/types';

type JsonRecord = Record<string, unknown>;

function connectionsCollection() {
  return adminDb.collection('gmail_connections');
}

function jobsCollection(organizationId: string) {
  return adminDb
    .collection('organizations')
    .doc(organizationId)
    .collection('gmail_sync_jobs');
}

function asIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function nowIso() {
  return new Date().toISOString();
}

function mapConnectionSnapshot(
  snapshot: FirebaseFirestore.DocumentSnapshot
): GmailConnectionRow {
  const data = (snapshot.data() || {}) as JsonRecord;
  return {
    id: snapshot.id,
    organization_id: String(data.organization_id || snapshot.id),
    google_email: String(data.google_email || ''),
    refresh_token_enc: String(data.refresh_token_enc || ''),
    access_token: data.access_token ? String(data.access_token) : null,
    token_expires_at: asIso(data.token_expires_at),
    connected_by_uid: String(data.connected_by_uid || ''),
    scopes: asStringArray(data.scopes),
    created_at: asIso(data.created_at) || nowIso(),
    updated_at: asIso(data.updated_at) || nowIso(),
    revoked_at: asIso(data.revoked_at),
  };
}

function mapJobSnapshot(snapshot: FirebaseFirestore.DocumentSnapshot): GmailSyncJobRow {
  const data = (snapshot.data() || {}) as JsonRecord;
  return {
    id: snapshot.id,
    organization_id: String(data.organization_id || ''),
    connection_id: String(data.connection_id || ''),
    source: (data.source === 'imap' ? 'imap' : 'gmail') as DteImportSource,
    date_from: String(data.date_from || ''),
    date_to: String(data.date_to || ''),
    status: String(data.status || 'running') as GmailSyncJobRow['status'],
    found_count: Number(data.found_count || 0),
    imported_count: Number(data.imported_count || 0),
    skipped_count: Number(data.skipped_count || 0),
    error_count: Number(data.error_count || 0),
    cursor: data.cursor ? String(data.cursor) : null,
    error_message: data.error_message ? String(data.error_message) : null,
    created_by_uid: String(data.created_by_uid || ''),
    created_at: asIso(data.created_at) || nowIso(),
    started_at: asIso(data.started_at),
    finished_at: asIso(data.finished_at),
    mailbox_skipped: data.mailbox_skipped === true,
    requested_date_from: data.requested_date_from
      ? String(data.requested_date_from)
      : null,
    requested_date_to: data.requested_date_to ? String(data.requested_date_to) : null,
    imap_uid_cache: data.imap_uid_cache ? String(data.imap_uid_cache) : null,
  };
}

export async function getActiveConnection(
  organizationId: string
): Promise<GmailConnectionRow | null> {
  const snapshot = await connectionsCollection().doc(organizationId).get();
  if (!snapshot.exists) return null;
  const connection = mapConnectionSnapshot(snapshot);
  return connection.revoked_at ? null : connection;
}

export async function upsertConnection(input: {
  organizationId: string;
  googleEmail: string;
  refreshToken: string;
  accessToken?: string | null;
  tokenExpiresAt?: Date | null;
  connectedByUid: string;
}) {
  const now = FieldValue.serverTimestamp();
  const ref = connectionsCollection().doc(input.organizationId);
  await ref.set(
    {
      organization_id: input.organizationId,
      google_email: input.googleEmail,
      refresh_token_enc: encryptSecret(input.refreshToken),
      access_token: input.accessToken ?? null,
      token_expires_at: input.tokenExpiresAt?.toISOString() ?? null,
      connected_by_uid: input.connectedByUid,
      scopes: GMAIL_SCOPES,
      updated_at: now,
      created_at: now,
      revoked_at: null,
    },
    { merge: true }
  );
  return mapConnectionSnapshot(await ref.get());
}

export async function updateConnectionAfterOAuth(input: {
  organizationId: string;
  googleEmail: string;
  accessToken?: string | null;
  tokenExpiresAt?: Date | null;
  connectedByUid: string;
}) {
  await connectionsCollection().doc(input.organizationId).set(
    {
      google_email: input.googleEmail,
      access_token: input.accessToken ?? null,
      token_expires_at: input.tokenExpiresAt?.toISOString() ?? null,
      connected_by_uid: input.connectedByUid,
      updated_at: FieldValue.serverTimestamp(),
      revoked_at: null,
    },
    { merge: true }
  );
}

export async function updateConnectionTokens(
  connectionId: string,
  accessToken: string,
  tokenExpiresAt: Date | null
) {
  await connectionsCollection().doc(connectionId).set(
    {
      access_token: accessToken,
      token_expires_at: tokenExpiresAt?.toISOString() ?? null,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function revokeConnection(organizationId: string) {
  await connectionsCollection().doc(organizationId).set(
    {
      revoked_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createSyncJob(input: {
  organizationId: string;
  connectionId: string;
  dateFrom: string;
  dateTo: string;
  createdByUid: string;
  source?: DteImportSource;
  requestedDateFrom?: string;
  requestedDateTo?: string;
}) {
  const ref = jobsCollection(input.organizationId).doc();
  const requestedFrom = input.requestedDateFrom ?? input.dateFrom;
  const requestedTo = input.requestedDateTo ?? input.dateTo;
  await ref.set({
    organization_id: input.organizationId,
    connection_id: input.connectionId,
    source: input.source || 'gmail',
    date_from: input.dateFrom,
    date_to: input.dateTo,
    requested_date_from: requestedFrom !== input.dateFrom ? requestedFrom : null,
    requested_date_to: requestedTo !== input.dateTo ? requestedTo : null,
    status: 'running',
    found_count: 0,
    imported_count: 0,
    skipped_count: 0,
    error_count: 0,
    cursor: null,
    error_message: null,
    created_by_uid: input.createdByUid,
    created_at: FieldValue.serverTimestamp(),
    started_at: FieldValue.serverTimestamp(),
    finished_at: null,
  });
  return mapJobSnapshot(await ref.get());
}

export async function getSyncJob(
  jobId: string,
  organizationId: string
): Promise<GmailSyncJobRow | null> {
  const snapshot = await jobsCollection(organizationId).doc(jobId).get();
  if (!snapshot.exists) return null;
  return mapJobSnapshot(snapshot);
}

export async function updateSyncJob(
  organizationId: string,
  jobId: string,
  patch: Partial<GmailSyncJobRow>
) {
  await jobsCollection(organizationId).doc(jobId).set(
    {
      ...patch,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getLastSyncJob(
  organizationId: string,
  source?: DteImportSource
) {
  const snapshot = await jobsCollection(organizationId)
    .orderBy('created_at', 'desc')
    .limit(source ? 25 : 1)
    .get();
  if (snapshot.empty) return null;
  const jobs = snapshot.docs.map(mapJobSnapshot);
  if (!source) return jobs[0];
  return jobs.find((job) => (job.source || 'gmail') === source) ?? null;
}

export async function listCompletedSyncJobs(
  organizationId: string,
  source?: DteImportSource,
  limit = 50
): Promise<GmailSyncJobRow[]> {
  const snapshot = await jobsCollection(organizationId)
    .orderBy('created_at', 'desc')
    .limit(Math.max(limit * 3, 50))
    .get();

  const jobs = snapshot.docs
    .map(mapJobSnapshot)
    .filter((job) => job.status === 'completed')
    .filter((job) => !source || (job.source || 'gmail') === source);

  return jobs.slice(0, limit);
}
