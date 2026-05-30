import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { mapOrganizationDoc } from '@/lib/organization-admin';
import { buildOrganizationDisplay } from '@/lib/org-display';
import { requireSuperadmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  try {
    await requireSuperadmin(req);

    const [orgsSnap, usersSnap] = await Promise.all([
      adminDb.collection('organizations').get(),
      adminDb.collection('users').where('role', '==', 'cliente').get(),
    ]);

    const orgById = new Map(
      orgsSnap.docs.map((d) => [d.id, mapOrganizationDoc(d.id, d.data()!)])
    );

    const clients = usersSnap.docs.map((d) => {
      const data = d.data();
      const orgId = String(data.organizationId ?? d.id);
      const org = orgById.get(orgId);
      return {
        uid: d.id,
        email: data.email,
        displayName: data.displayName,
        organizationId: orgId,
        membership: data.membership,
        organization: org
          ? {
              name: org.name,
              ...buildOrganizationDisplay(org),
              allowedEmailDomain: org.allowedEmailDomain,
              membershipType: org.membershipType,
              maxCollaborators: org.maxCollaborators,
              collaboratorCount: org.collaboratorCount,
              status: org.status,
              kycCompleted: org.kyc.kycCompleted,
            }
          : null,
      };
    });

    return NextResponse.json({ clients });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 500 }
    );
  }
}
