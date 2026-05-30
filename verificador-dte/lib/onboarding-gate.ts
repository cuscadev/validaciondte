import type { AppUser } from '@/lib/firestoreUser';

export type OrgKycSnapshot = {
  kyc?: { kycCompleted?: boolean };
  status?: string;
} | null;

export function clientNeedsSetup(
  appUser: Pick<AppUser, 'role' | 'mustChangePassword'> | null | undefined,
  org: OrgKycSnapshot
): boolean {
  if (!appUser || appUser.role !== 'cliente') return false;
  return Boolean(appUser.mustChangePassword || !org?.kyc?.kycCompleted);
}

export function collaboratorNeedsPassword(
  appUser: Pick<AppUser, 'role' | 'mustChangePassword'> | null | undefined
): boolean {
  return appUser?.role === 'colaborador' && Boolean(appUser.mustChangePassword);
}

export function userNeedsOnboardingRoute(
  appUser: Pick<AppUser, 'role' | 'mustChangePassword' | 'onboardingCompleted'> | null | undefined,
  org?: OrgKycSnapshot
): boolean {
  if (!appUser) return false;
  if (appUser.mustChangePassword) return true;
  if (appUser.role === 'colaborador') {
    return collaboratorNeedsPassword(appUser);
  }
  if (appUser.role === 'cliente') {
    if (appUser.onboardingCompleted !== true) return true;
    return clientNeedsSetup(appUser, org ?? null);
  }
  return false;
}

/** Misma condición que login y shell: debe ir a /onboarding, no al panel. */
export function userNeedsOnboardingPath(
  appUser: Pick<AppUser, 'role' | 'mustChangePassword' | 'onboardingCompleted'> | null | undefined,
  org?: OrgKycSnapshot
): boolean {
  return userNeedsOnboardingRoute(appUser, org);
}
