import type { AppUser } from '@/lib/firestoreUser';

const PROFILE_GATE_KEYS = [
  'uid',
  'role',
  'onboardingCompleted',
  'mustChangePassword',
  'accountStatus',
  'disabled',
  'organizationId',
  'orgRole',
] as const satisfies readonly (keyof AppUser)[];

export function profileEquals(a: AppUser, b: AppUser): boolean {
  return PROFILE_GATE_KEYS.every((key) => a[key] === b[key]);
}

export function mergeAppUserIfChanged(
  prev: AppUser | null,
  next: AppUser | null
): AppUser | null {
  if (!next) return null;
  if (prev && profileEquals(prev, next)) return prev;
  return next;
}
