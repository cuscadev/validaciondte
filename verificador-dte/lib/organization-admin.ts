import { adminDb } from '@/lib/firebase-admin';
import type { MembershipType } from '@/lib/firestoreUser';
import {
  DEFAULT_MAX_COLLABORATORS,
  type Organization,
  type OrganizationKyc,
  type PlanConfigWithSeats,
} from '@/lib/organization-types';

const ORGS = 'organizations';

export function normalizeEmailDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9.-]/g, '');
}

export function emailMatchesDomain(email: string, domain: string): boolean {
  const normalized = email.trim().toLowerCase();
  const d = normalizeEmailDomain(domain);
  return normalized.endsWith(`@${d}`);
}

export async function getMaxCollaboratorsFromPlan(
  membershipType: MembershipType
): Promise<number> {
  const snap = await adminDb.doc('config/plans').get();
  const plans = snap.data() as Record<string, PlanConfigWithSeats> | undefined;
  const fromPlan = plans?.[membershipType]?.maxCollaborators;
  if (typeof fromPlan === 'number' && fromPlan >= 0) return fromPlan;
  return DEFAULT_MAX_COLLABORATORS[membershipType] ?? 2;
}

function defaultKyc(): OrganizationKyc {
  return {
    onboardingCompleted: false,
    kycCompleted: false,
    personType: null,
    fullLegalName: '',
    hasHomologatedDui: null,
    dui: null,
    nit: null,
    nrc: null,
    fiscalAddress: null,
    companyLegalName: null,
    companyNit: null,
    companyNrc: null,
    companyNcr: null,
    groupName: null,
    termsAccepted: false,
    privacyAccepted: false,
    acceptedLegalAt: null,
    kycCompletedAt: null,
  };
}

export function mapOrganizationDoc(
  id: string,
  data: Record<string, unknown>
): Organization {
  const kycRaw = data.kyc ?? {};
  return {
    id,
    ownerUid: String(data.ownerUid ?? id),
    name: String(data.name ?? ''),
    allowedEmailDomain: String(data.allowedEmailDomain ?? ''),
    membershipType: (data.membershipType as MembershipType) ?? 'free',
    maxCollaborators: Number(data.maxCollaborators ?? 2),
    collaboratorCount: Number(data.collaboratorCount ?? 0),
    status: data.status === 'suspended' ? 'suspended' : 'active',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    kyc: {
      ...defaultKyc(),
      ...kycRaw,
    } as OrganizationKyc,
  };
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const snap = await adminDb.collection(ORGS).doc(orgId).get();
  if (!snap.exists) return null;
  return mapOrganizationDoc(snap.id, snap.data()!);
}

export async function createOrganizationForOwner(params: {
  ownerUid: string;
  name: string;
  email: string;
  membershipType?: MembershipType;
}): Promise<Organization> {
  const membershipType = params.membershipType ?? 'free';
  const maxCollaborators = await getMaxCollaboratorsFromPlan(membershipType);
  const now = new Date();
  const orgId = params.ownerUid;

  const payload = {
    ownerUid: params.ownerUid,
    name: params.name || params.email,
    allowedEmailDomain: '',
    membershipType,
    maxCollaborators,
    collaboratorCount: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    kyc: defaultKyc(),
  };

  await adminDb.collection(ORGS).doc(orgId).set(payload);
  return mapOrganizationDoc(orgId, payload);
}

export async function updateOrganization(
  orgId: string,
  patch: Record<string, unknown>
) {
  await adminDb
    .collection(ORGS)
    .doc(orgId)
    .set({ ...patch, updatedAt: new Date() }, { merge: true });
}

export async function countCollaborators(orgId: string): Promise<number> {
  const snap = await adminDb
    .collection('users')
    .where('organizationId', '==', orgId)
    .where('role', '==', 'colaborador')
    .get();
  return snap.size;
}

export async function syncCollaboratorCount(orgId: string) {
  const count = await countCollaborators(orgId);
  await updateOrganization(orgId, { collaboratorCount: count });
  return count;
}

export async function assertCanAddCollaborator(orgId: string) {
  const org = await getOrganization(orgId);
  if (!org) throw new Error('Organización no encontrada');
  if (org.status === 'suspended') {
    throw new Error('La organización está suspendida.');
  }
  if (!org.kyc.kycCompleted) {
    throw new Error('Completa el onboarding antes de invitar usuarios.');
  }
  const count = await syncCollaboratorCount(orgId);
  if (count >= org.maxCollaborators) {
    throw new Error(
      `Límite de usuarios alcanzado (${count}/${org.maxCollaborators}). Actualiza tu plan.`
    );
  }
  return org;
}

export async function listCollaborators(orgId: string) {
  const snap = await adminDb
    .collection('users')
    .where('organizationId', '==', orgId)
    .where('role', '==', 'colaborador')
    .get();
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
