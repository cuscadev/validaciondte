import type { OrgRole } from '@/lib/firestoreUser';
import type { Organization, PersonType } from '@/lib/organization-types';

const MAX_GROUP_NAME_LENGTH = 120;

export const GROUP_NAME_REQUIRED_FOR_DELEGATE_MSG =
  'Indica el nombre del grupo antes de invitar a un delegado.';

export function sanitizeGroupName(raw: string): string {
  return raw.trim().slice(0, MAX_GROUP_NAME_LENGTH);
}

export function getOrgLegalName(org: Pick<Organization, 'kyc'>): string {
  const { kyc } = org;
  if (kyc.personType === 'juridica') {
    return kyc.companyLegalName?.trim() || kyc.fullLegalName?.trim() || '';
  }
  return kyc.fullLegalName?.trim() || '';
}

export function getOrgDisplayTitle(org: Pick<Organization, 'name' | 'kyc'>): string {
  const { kyc } = org;
  if (kyc.personType === 'juridica') {
    return kyc.companyLegalName?.trim() || org.name?.trim() || getOrgLegalName(org);
  }
  if (isNaturalOrganization(org)) {
    return kyc.groupName?.trim() || kyc.fullLegalName?.trim() || org.name?.trim() || '';
  }
  return org.name?.trim() || getOrgLegalName(org) || '';
}

export function isNaturalOrganization(org: Pick<Organization, 'kyc'>): boolean {
  const { kyc } = org;
  if (kyc.personType === 'juridica') return false;
  if (kyc.personType === 'natural') return true;
  const hasCompany = Boolean(kyc.companyLegalName?.trim());
  const hasLegalName = Boolean(kyc.fullLegalName?.trim());
  return hasLegalName && !hasCompany;
}

export function needsGroupNameForFirstDelegate(
  org: Pick<Organization, 'kyc'>,
  collaboratorCount: number
): boolean {
  return (
    isNaturalOrganization(org) &&
    !org.kyc.groupName?.trim() &&
    collaboratorCount === 0
  );
}

export function needsGroupNameForFirstInvite(params: {
  personType: PersonType | null;
  groupName: string | null;
  legalName?: string | null;
  collaboratorCount: number;
}): boolean {
  const syntheticOrg = {
    kyc: {
      personType: params.personType,
      groupName: params.groupName,
      fullLegalName: params.legalName ?? '',
      companyLegalName: params.personType === 'juridica' ? params.legalName ?? '' : null,
    },
  } as Pick<Organization, 'kyc'>;
  return needsGroupNameForFirstDelegate(syntheticOrg, params.collaboratorCount);
}

export function getOrgDisplaySubtitle(org: Pick<Organization, 'kyc'>): string | null {
  const { kyc } = org;
  if (isNaturalOrganization(org) && kyc.groupName?.trim()) {
    const legal = kyc.fullLegalName?.trim();
    return legal ? `Titular: ${legal}` : null;
  }
  return null;
}

export function getOrgRoleLabel(
  role: 'cliente' | 'colaborador' | string,
  orgRole?: OrgRole | string | null
): string {
  if (role === 'cliente') return 'Titular';
  if (orgRole === 'administrador') return 'Delegado (gestión de usuarios)';
  return 'Delegado';
}

export type OrgDirectorySegment = 'juridica' | 'natural' | 'natural_with_group';

export function getOrgDirectorySegment(org: Pick<Organization, 'kyc'>): OrgDirectorySegment {
  if (isNaturalOrganization(org)) {
    if (org.kyc.groupName?.trim()) return 'natural_with_group';
    return 'natural';
  }
  return 'juridica';
}

export function getOrgDirectorySegmentLabel(segment: OrgDirectorySegment): string {
  switch (segment) {
    case 'juridica':
      return 'Jurídica';
    case 'natural':
      return 'Natural';
    case 'natural_with_group':
      return 'Natural con grupo';
  }
}

export function getOrgDirectorySegmentFromDisplay(params: {
  personType?: PersonType | null;
  groupName?: string | null;
  legalName?: string | null;
}): OrgDirectorySegment {
  const syntheticOrg = {
    kyc: {
      personType: params.personType,
      groupName: params.groupName,
      fullLegalName: params.legalName ?? '',
      companyLegalName: params.personType === 'juridica' ? params.legalName ?? '' : null,
    },
  } as Pick<Organization, 'kyc'>;
  return getOrgDirectorySegment(syntheticOrg);
}

export function buildOrganizationDisplay(org: Organization) {
  const personType = isNaturalOrganization(org)
    ? ('natural' as PersonType)
    : org.kyc.personType === 'juridica'
      ? ('juridica' as PersonType)
      : (org.kyc.personType as PersonType | null);

  return {
    displayTitle: getOrgDisplayTitle(org),
    displaySubtitle: getOrgDisplaySubtitle(org),
    personType,
    groupName: org.kyc.groupName?.trim() || null,
    legalName: getOrgLegalName(org),
  };
}
