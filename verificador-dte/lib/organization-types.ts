import type { MembershipType } from '@/lib/firestoreUser';

export type PersonType = 'natural' | 'juridica';
export type OrgRole = 'administrador' | 'miembro';
export type AccountStatus = 'active' | 'inactive' | 'blocked';
export type OrganizationStatus = 'active' | 'suspended';

export interface OrganizationKyc {
  onboardingCompleted: boolean;
  kycCompleted: boolean;
  personType: PersonType | null;
  fullLegalName: string;
  hasHomologatedDui: boolean | null;
  dui: string | null;
  nit: string | null;
  nrc: string | null;
  fiscalAddress: string | null;
  companyLegalName: string | null;
  companyNit: string | null;
  companyNrc: string | null;
  /** @deprecated Use companyNrc. Kept to read organizations saved before the typo fix. */
  companyNcr: string | null;
  groupName: string | null;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  acceptedLegalAt: string | null;
  kycCompletedAt: string | null;
}

export interface Organization {
  id: string;
  ownerUid: string;
  name: string;
  allowedEmailDomain: string;
  membershipType: MembershipType;
  maxCollaborators: number;
  collaboratorCount: number;
  status: OrganizationStatus;
  createdAt: unknown;
  updatedAt: unknown;
  kyc: OrganizationKyc;
  limits?: {
    routeLimits?: Record<string, number | null>;
    mobileScanFolderLimit?: number | null;
    resetDayOfMonth?: number;
    renewalDate?: string;
    automaticReset?: boolean;
  };
}

export interface PlanConfigWithSeats {
  maxCollaborators?: number;
  queryLimit?: number | null;
  mobileScanFolderLimit?: number | null;
  routeLimits?: Record<string, number | null>;
  resetDayOfMonth?: number;
  renewalDate?: string;
  automaticReset?: boolean;
  allowedRoutes?: string[];
  price?: number;
  currency?: string;
  billingCycle?: string;
  dateFrom?: string;
  dateTo?: string;
  visibleInLanding?: boolean;
}

export const DEFAULT_MAX_COLLABORATORS: Record<MembershipType, number> = {
  free: 2,
  premium: 10,
  pro: 50,
};
