import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  type AppUser,
  canManageOrgUsers,
  isOrgAdmin,
  resolveOrganizationId,
  type UserRole,
} from '@/lib/firestoreUser';
import { getOrganization } from '@/lib/organization-admin';
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie';

export type AuthUser = AppUser & { email: string };

async function loadAppUser(uid: string): Promise<AuthUser | null> {
  const userSnap = await adminDb.collection('users').doc(uid).get();
  if (!userSnap.exists) return null;
  const data = userSnap.data()!;
  return {
    ...(data as Omit<AppUser, 'uid'>),
    uid,
    email: String(data.email ?? ''),
  };
}

export async function verifyBearer(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies.get(SESSION_COOKIE_NAME)?.value || '';
  if (!token) throw new Error('No autorizado');
  const decoded = await adminAuth.verifyIdToken(token);
  return decoded;
}

export async function requireSuperadmin(req: NextRequest) {
  const decoded = await verifyBearer(req);
  const user = await loadAppUser(decoded.uid);
  if (user?.role !== 'superadmin') throw new Error('No autorizado');
  return user;
}

export async function requireAuth(req: NextRequest) {
  const decoded = await verifyBearer(req);
  const user = await loadAppUser(decoded.uid);
  if (!user) throw new Error('No autorizado');
  return user;
}

export async function requireOrgAdmin(req: NextRequest) {
  const user = await requireAuth(req);
  if (!canManageOrgUsers(user)) throw new Error('No autorizado');
  const organizationId = resolveOrganizationId(user);
  if (!organizationId) throw new Error('Sin organización asignada');
  return { ...user, organizationId };
}

export async function requireOrgMember(req: NextRequest) {
  const user = await requireAuth(req);
  if (user.role === 'superadmin') {
    const organizationId = resolveOrganizationId(user);
    return organizationId ? { ...user, organizationId } : user;
  }
  const organizationId = resolveOrganizationId(user);
  if (!organizationId) throw new Error('Sin organización asignada');
  return { ...user, organizationId };
}

export async function getAuthUserRole(uid: string): Promise<UserRole | ''> {
  const user = await loadAppUser(uid);
  return user?.role ?? '';
}

export async function requireKycCompleteForUser(user: AuthUser) {
  if (user.role === 'superadmin') return;
  if (!user.organizationId) return;
  const org = await getOrganization(user.organizationId);
  if (!org?.kyc.kycCompleted) {
    throw new Error('Onboarding KYC incompleto');
  }
  if (org.status === 'suspended') {
    throw new Error('Organización suspendida');
  }
}

export { isOrgAdmin };
