import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { syncCollaboratorCount } from '@/lib/organization-admin';
import { requireOrgAdmin } from '@/lib/server-auth';
import type { AccountStatus, OrgRole } from '@/lib/firestoreUser';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const adminUser = await requireOrgAdmin(req);
    const { uid } = await params;
    const orgId = adminUser.organizationId!;

    const targetSnap = await adminDb.collection('users').doc(uid).get();
    if (!targetSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    const target = targetSnap.data()!;
    if (target.organizationId !== orgId || target.role !== 'colaborador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json() as {
      orgRole?: OrgRole;
      accountStatus?: AccountStatus;
      displayName?: string;
    };

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (body.orgRole === 'administrador' || body.orgRole === 'miembro') {
      patch.orgRole = body.orgRole;
    }

    if (body.displayName?.trim()) {
      patch.displayName = body.displayName.trim();
      await adminAuth.updateUser(uid, { displayName: body.displayName.trim() });
    }

    if (body.accountStatus === 'active' || body.accountStatus === 'inactive' || body.accountStatus === 'blocked') {
      patch.accountStatus = body.accountStatus;
      patch.disabled = body.accountStatus === 'blocked';
      await adminAuth.updateUser(uid, { disabled: body.accountStatus === 'blocked' });
      if (body.accountStatus === 'blocked') {
        await adminAuth.revokeRefreshTokens(uid);
        patch.blockedAt = new Date();
      }
    }

    await adminDb.collection('users').doc(uid).set(patch, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const adminUser = await requireOrgAdmin(req);
    const { uid } = await params;
    const orgId = adminUser.organizationId!;

    const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
    const ownerUid = String(orgSnap.data()?.ownerUid ?? '');
    if (uid === ownerUid) {
      return NextResponse.json(
        { error: 'No puedes eliminar la cuenta del titular.' },
        { status: 400 }
      );
    }

    const targetSnap = await adminDb.collection('users').doc(uid).get();
    if (!targetSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    const target = targetSnap.data()!;
    if (target.organizationId !== orgId || target.role !== 'colaborador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await adminAuth.deleteUser(uid);
    await adminDb.collection('users').doc(uid).delete();
    await syncCollaboratorCount(orgId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
