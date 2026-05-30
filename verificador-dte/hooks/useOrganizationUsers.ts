'use client';



import { useQuery } from '@tanstack/react-query';

import { auth } from '@/lib/firebase';

import { canManageOrgUsers, type AccountStatus, type OrgRole } from '@/lib/firestoreUser';

import { useAuth } from '@/components/AuthProvider';

import { ORGANIZATION_QUERY_STALE_MS } from '@/hooks/useOrganizationMe';

import type { PersonType } from '@/lib/organization-types';



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



async function fetchOrganizationUsers(): Promise<OrganizationUsersResponse> {

  const token = await auth.currentUser?.getIdToken();

  if (!token) throw new Error('No autorizado');

  const res = await fetch('/api/organization/users', {

    headers: { Authorization: `Bearer ${token}` },

  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Error al cargar');

  return {

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

  };

}


export function useOrganizationUsers(options?: { enabled?: boolean }) {

  const { authChecked, isAuthenticated, appUser } = useAuth();



  const defaultEnabled =

    authChecked && isAuthenticated && canManageOrgUsers(appUser);



  return useQuery({

    queryKey: ['organization', 'users'],

    queryFn: fetchOrganizationUsers,

    enabled: options?.enabled ?? defaultEnabled,

    staleTime: ORGANIZATION_QUERY_STALE_MS,

    placeholderData: (previous) => previous,

  });

}
