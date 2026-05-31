'use client';

import type { Organization } from '@/lib/organization-types';
import { useGetQuery } from '@/lib/tanstack-query';
import { useAuth } from '@/components/AuthProvider';

export type OrganizationMeResponse = {
  organization: Organization | null;
  user?: { role: string; orgRole?: string };
};

export function useOrganizationMe(options?: { enabled?: boolean }) {
  const { authChecked, isAuthenticated, appUser } = useAuth();

  const defaultEnabled =
    authChecked &&
    isAuthenticated &&
    appUser?.role !== 'superadmin' &&
    Boolean(appUser?.organizationId);

  return useGetQuery<OrganizationMeResponse>({
    queryKey: ['organization', 'me'],
    path: '/api/organization/me',
    enabled: options?.enabled ?? defaultEnabled,
    overrides: {
      placeholderData: (previous) => previous,
    },
  });
}
