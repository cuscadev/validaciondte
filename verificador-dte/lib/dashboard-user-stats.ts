import type { AccountStatus } from '@/lib/firestoreUser';

export type DashboardUserStats = {
  total: number;
  active: number;
  inactive: number;
  scope: 'organization' | 'platform';
  label: string;
};

type UserStatusRecord = {
  accountStatus?: AccountStatus | string;
  disabled?: boolean;
};

export function resolveUserAccountStatus(
  user: UserStatusRecord
): AccountStatus {
  if (user.disabled) return 'blocked';
  const status = user.accountStatus ?? 'active';
  if (status === 'inactive' || status === 'blocked') return status;
  return 'active';
}

export function countUsersByStatus(
  users: UserStatusRecord[]
): Pick<DashboardUserStats, 'total' | 'active' | 'inactive'> {
  let active = 0;
  let inactive = 0;

  for (const user of users) {
    const status = resolveUserAccountStatus(user);
    if (status === 'active') {
      active += 1;
    } else {
      inactive += 1;
    }
  }

  return {
    total: users.length,
    active,
    inactive,
  };
}
