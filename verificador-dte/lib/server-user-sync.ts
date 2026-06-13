/**
 * Sincroniza perfiles de Firestore hacia Postgres vía go-dte-api.
 * Firebase Auth sigue siendo la fuente de login; Postgres es espejo para FKs.
 */
import { getGoDteApiUrl } from '@/lib/go-dte-api';
import type { AppUser, AccountStatus, OrgRole, UserRole } from '@/lib/firestoreUser';

export type AppUserSyncPayload = {
  id: string;
  email: string;
  role: UserRole;
  organizationId?: string | null;
  orgRole?: OrgRole | null;
  accountStatus?: AccountStatus;
  displayName?: string | null;
  disabled?: boolean;
  membershipType?: string | null;
  membershipExpiresAt?: string | null;
};

function internalHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  const key = process.env.GO_DTE_INTERNAL_API_KEY?.trim();
  if (key) headers['X-Go-Dte-Internal-Key'] = key;
  return headers;
}

async function goFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${getGoDteApiUrl()}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...internalHeaders(),
      ...(init?.headers || {}),
    },
  });
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asOptionalString(value: unknown): string | null {
  const trimmed = asString(value);
  return trimmed || null;
}

function asRole(value: unknown): UserRole {
  if (value === 'superadmin' || value === 'cliente' || value === 'colaborador') {
    return value;
  }
  return 'cliente';
}

function asOrgRole(value: unknown): OrgRole | null {
  if (value === 'administrador' || value === 'miembro') return value;
  return null;
}

function asAccountStatus(value: unknown, disabled?: boolean): AccountStatus {
  if (disabled) return 'blocked';
  if (value === 'inactive' || value === 'blocked') return value;
  return 'active';
}

function readMembership(user: Record<string, unknown>) {
  const membership = user.membership;
  if (!membership || typeof membership !== 'object') {
    return { type: null as string | null, expiresAt: null as string | null };
  }
  const record = membership as Record<string, unknown>;
  return {
    type: asOptionalString(record.type),
    expiresAt: asOptionalString(record.expiresAt),
  };
}

export function mapFirestoreUserToSyncPayload(
  user: Partial<AppUser> & { uid?: string; id?: string; active?: boolean }
): AppUserSyncPayload | null {
  const id = asString(user.uid || user.id);
  const email = asString(user.email).toLowerCase();
  if (!id || !email) return null;

  const disabled = user.disabled === true || user.active === false;
  const membership = readMembership(user as Record<string, unknown>);

  return {
    id,
    email,
    role: asRole(user.role),
    organizationId: asOptionalString(user.organizationId),
    orgRole: asOrgRole(user.orgRole),
    accountStatus: asAccountStatus(user.accountStatus, disabled),
    displayName: asOptionalString(user.displayName),
    disabled,
    membershipType: membership.type,
    membershipExpiresAt: membership.expiresAt,
  };
}

export async function syncAppUserToPostgres(
  profile: Partial<AppUser> & { uid?: string; id?: string; active?: boolean }
): Promise<void> {
  const payload = mapFirestoreUserToSyncPayload(profile);
  if (!payload) {
    console.warn('[user-sync] Perfil sin id/email, omitiendo sync:', profile);
    return;
  }

  const res = await goFetch(`/api/app-users/${encodeURIComponent(payload.id)}`, {
    method: 'PUT',
    body: JSON.stringify(toApiBody(payload)),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `[user-sync] Error ${res.status} sincronizando ${payload.id}`);
  }
}

export async function syncAppUserFromFirestore(
  loadUser: () => Promise<(Partial<AppUser> & { uid?: string; active?: boolean }) | null>
): Promise<void> {
  const profile = await loadUser();
  if (!profile) {
    console.warn('[user-sync] Documento Firestore no encontrado, omitiendo sync');
    return;
  }
  await syncAppUserToPostgres(profile);
}

export async function deleteAppUserFromPostgres(uid: string): Promise<void> {
  const cleanUid = uid.trim();
  if (!cleanUid) return;

  const res = await goFetch(`/api/app-users/${encodeURIComponent(cleanUid)}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `[user-sync] Error ${res.status} eliminando ${cleanUid}`);
  }
}

export async function bulkSyncAppUsersToPostgres(
  users: Array<Partial<AppUser> & { uid?: string; id?: string; active?: boolean }>
): Promise<{ total: number; upserted: number; errors: string[] }> {
  const payloads = users
    .map((user) => mapFirestoreUserToSyncPayload(user))
    .filter((user): user is AppUserSyncPayload => user !== null);

  const res = await goFetch('/api/app-users/bulk', {
    method: 'POST',
    body: JSON.stringify({ users: payloads.map(toApiBody) }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `[user-sync] Error ${res.status} en bulk sync`);
  }

  return res.json() as Promise<{ total: number; upserted: number; errors: string[] }>;
}

function toApiBody(payload: AppUserSyncPayload) {
  return {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    organizationId: payload.organizationId,
    orgRole: payload.orgRole,
    accountStatus: payload.accountStatus ?? 'active',
    displayName: payload.displayName,
    disabled: payload.disabled ?? false,
    membershipType: payload.membershipType,
    membershipExpiresAt: payload.membershipExpiresAt,
  };
}

/** Lee el doc Firestore y sincroniza; no lanza si falla Postgres (rollout seguro). */
export async function syncAppUserAfterFirestoreWrite(uid: string): Promise<void> {
  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb.collection('users').doc(uid).get();
    if (!snap.exists) return;
    await syncAppUserToPostgres({ uid, ...(snap.data() as Partial<AppUser>), active: undefined });
  } catch (error) {
    console.error('[user-sync] Error sincronizando usuario', uid, error);
  }
}

/** Elimina el espejo en Postgres; no lanza si falla. */
export async function deleteAppUserAfterFirestoreDelete(uid: string): Promise<void> {
  try {
    await deleteAppUserFromPostgres(uid);
  } catch (error) {
    console.error('[user-sync] Error eliminando usuario', uid, error);
  }
}
