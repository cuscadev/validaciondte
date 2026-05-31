'use client';

import { canManageOrgUsers, type AccountStatus, type OrgRole } from '@/lib/firestoreUser';
import type { PersonType } from '@/lib/organization-types';
import { useGetQuery } from '@/lib/tanstack-query';
import { useAuth } from '@/components/AuthProvider';

export type Collaborator = {
  uid: string;
  email: string;
  displayName?: string;
  orgRole?: OrgRole;
  accountStatus?: AccountStatus;
  disabled?: boolean;
};

export type OrganizationUsersSummary = {
  displayTitle: string;
  displaySubtitle: string | null;
  personType: PersonType | null;
  groupName: string | null;
  legalName: string;
};

export type OrganizationOwner = {
  uid: string;
  email: string;
  displayName: string;
};

export type OrganizationUsersResponse = {
  organization: OrganizationUsersSummary;
  owner: OrganizationOwner | null;
  collaborators: Collaborator[];
  seats: { used: number; max: number; domain: string };
};

export function useOrganizationUsers(options?: { enabled?: boolean }) {
  const { authChecked, isAuthenticated, appUser } = useAuth();

  const defaultEnabled =
    authChecked && isAuthenticated && canManageOrgUsers(appUser);

  return useGetQuery<OrganizationUsersResponse>({
    queryKey: ['organization', 'users'],
    path: '/api/organization/users',
    enabled: options?.enabled ?? defaultEnabled,
    overrides: {
      placeholderData: (previous) => previous,
      select: (data): OrganizationUsersResponse => ({
        organization: data.organization ?? {
          displayTitle: '',
          displaySubtitle: null,
          personType: null,
          groupName: null,
          legalName: '',
        },
        owner: data.owner ?? null,
        collaborators: data.collaborators ?? [],
        seats: data.seats ?? { used: 0, max: 0, domain: '' },
      }),
    },
  });
}
