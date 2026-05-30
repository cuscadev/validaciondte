import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getOrganization, listCollaborators } from '@/lib/organization-admin';
import { buildOrganizationDisplay } from '@/lib/org-display';
import { requireSuperadmin } from '@/lib/server-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireSuperadmin(req);
    const { orgId } = await params;
    const org = await getOrganization(orgId);
    if (!org) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
    }

    const [ownerSnap, collaborators] = await Promise.all([
      adminDb.collection('users').doc(org.ownerUid).get(),
      listCollaborators(orgId),
    ]);
    const ownerData = ownerSnap.data();

    return NextResponse.json({
      organization: {
        id: orgId,
        name: org.name,
        ...buildOrganizationDisplay(org),
        allowedEmailDomain: org.allowedEmailDomain,
        membershipType: org.membershipType,
        collaboratorCount: org.collaboratorCount,
        maxCollaborators: org.maxCollaborators,
        status: org.status,
        kycCompleted: org.kyc.kycCompleted,
      },
      owner: ownerSnap.exists
        ? {
            uid: ownerSnap.id,
            email: String(ownerData?.email ?? ''),
            displayName: String(ownerData?.displayName ?? ''),
          }
        : null,
      collaborators: collaborators.map((c) => {
        const row = c as Record<string, unknown>;
        return {
          uid: c.uid,
          email: String(row.email ?? ''),
          displayName: String(row.displayName ?? ''),
          orgRole: String(row.orgRole ?? 'miembro'),
          accountStatus: String(
            row.accountStatus ?? (row.disabled ? 'blocked' : 'active')
          ),
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireSuperadmin(req);
    const { orgId } = await params;
    const body = await req.json() as {
      maxCollaborators?: number;
      status?: 'active' | 'suspended';
    };

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.maxCollaborators === 'number' && body.maxCollaborators >= 0) {
      patch.maxCollaborators = body.maxCollaborators;
    }
    if (body.status === 'active' || body.status === 'suspended') {
      patch.status = body.status;
    }

    await adminDb.collection('organizations').doc(orgId).set(patch, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 500 }
    );
  }
}
