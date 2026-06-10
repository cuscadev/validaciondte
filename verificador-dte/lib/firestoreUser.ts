import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { cachedGet, invalidateCache } from './firestoreCache';

const USER_CACHE_SECONDS = 15;

export type UserRole = 'superadmin' | 'cliente' | 'colaborador';
export type MembershipType = 'free' | 'premium' | 'pro';
export type OrgRole = 'administrador' | 'miembro';
export type AccountStatus = 'active' | 'inactive' | 'blocked';

export interface Membership {
  type: MembershipType;
  expiresAt: string; // ISO date
}

export interface UsageLimits {
  routeLimits?: Record<string, number | null>;
  mobileScanFolderLimit?: number | null;
  resetDayOfMonth?: number;
  renewalDate?: string;
  automaticReset?: boolean;
}

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  membership: Membership;
  displayName?: string;
  phoneNumber?: string;
  company?: string;
  photoURL?: string;
  cliente?: string;
  organizationId?: string;
  orgRole?: OrgRole;
  accountStatus?: AccountStatus;
  onboardingCompleted?: boolean;
  totpEnabled?: boolean;
  mustChangePassword?: boolean;
  disabled?: boolean;
  forceLogoutAt?: unknown;
  blockedAt?: unknown;
  limits?: UsageLimits;
}

export function isOrgAdmin(user: Pick<AppUser, 'role' | 'orgRole'> | null | undefined) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  if (user.role === 'cliente') return true;
  return user.role === 'colaborador' && user.orgRole === 'administrador';
}

export function canManageOrgUsers(user: Pick<AppUser, 'role' | 'orgRole'> | null | undefined) {
  return isOrgAdmin(user);
}

/** Id efectivo de organización (titular/superadmin sin campo → uid del usuario). */
export function resolveOrganizationId(
  user: Pick<AppUser, 'uid' | 'role' | 'organizationId'> | null | undefined
): string | null {
  if (!user) return null;
  const explicit = user.organizationId?.trim();
  if (explicit) return explicit;
  if (user.role === 'cliente' || user.role === 'superadmin') return user.uid;
  return null;
}

export function isAccountUsable(user: Pick<AppUser, 'accountStatus' | 'disabled'> | null | undefined) {
  if (!user) return false;
  if (user.disabled) return false;
  const status = user.accountStatus ?? 'active';
  return status === 'active';
}

export async function getUser(uid: string): Promise<AppUser | null> {
  return cachedGet(
    `users/${uid}`,
    async () => {
      const ref = doc(db, 'users', uid);
      const snap = await getDoc(ref);
      return snap.exists() ? ({ ...(snap.data() as Omit<AppUser, 'uid'>), uid: snap.id }) : null;
    },
    USER_CACHE_SECONDS
  );
}

export async function getAllUsers(): Promise<AppUser[]> {
  return cachedGet(
    'users',
    async () => {
      const ref = collection(db, 'users');
      const snap = await getDocs(ref);
      return snap.docs.map(d => ({ ...(d.data() as Omit<AppUser, 'uid'>), uid: d.id }));
    },
    USER_CACHE_SECONDS
  );
}

export async function createUser(user: AppUser) {
  await setDoc(doc(db, 'users', user.uid), user);
  invalidateCache(`users/${user.uid}`);
  invalidateCache('users');
}

export async function updateUser(uid: string, data: Partial<AppUser>) {
  await updateDoc(doc(db, 'users', uid), data);
  invalidateCache(`users/${uid}`);
  invalidateCache('users');
}

export async function deleteUser(uid: string) {
  await deleteDoc(doc(db, 'users', uid));
  invalidateCache(`users/${uid}`);
  invalidateCache('users');
}
