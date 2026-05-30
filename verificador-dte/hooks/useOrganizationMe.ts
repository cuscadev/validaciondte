'use client';

import { useQuery } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import type { Organization } from '@/lib/organization-types';
import { useAuth } from '@/components/AuthProvider';

export const ORGANIZATION_QUERY_STALE_MS = 60_000;

export type OrganizationMeResponse = {
  organization: Organization | null;
  user?: { role: string; orgRole?: string };
};

async function fetchOrganizationMe(): Promise<OrganizationMeResponse> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('No autorizado');
  const res = await fetch('/api/organization/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al cargar organización');
  return data as OrganizationMeResponse;
}

export function useOrganizationMe(options?: { enabled?: boolean }) {
  const { authChecked, isAuthenticated, appUser } = useAuth();

  const defaultEnabled =
    authChecked &&
    isAuthenticated &&
    appUser?.role !== 'superadmin' &&
    Boolean(appUser?.organizationId);

  return useQuery({
    queryKey: ['organization', 'me'],
    queryFn: fetchOrganizationMe,
    enabled: options?.enabled ?? defaultEnabled,
    staleTime: ORGANIZATION_QUERY_STALE_MS,
    placeholderData: (previous) => previous,
  });
}
