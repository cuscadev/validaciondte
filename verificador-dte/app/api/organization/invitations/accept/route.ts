import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { syncCollaboratorCount } from '@/lib/organization-admin';
import { getUserDocByEmail } from '@/lib/server-users';

function invitationExpired(value: unknown) {
  if (!value) return true;
  if (value instanceof Date) return value.getTime() < Date.now();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const timestamp = value as { toDate?: () => Date };
    return (timestamp.toDate?.().getTime() ?? 0) < Date.now();
  }
  return true;
}

async function getInvitation(token: string) {
  if (!token) return null;
  const snap = await adminDb.collection('collaboratorInvitations').doc(token).get();
  if (!snap.exists) return null;
  return { ref: snap.ref, data: snap.data() || {} };
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token') || '';
    const invitation = await getInvitation(token);
    if (!invitation || invitation.data.status !== 'pending' || invitationExpired(invitation.data.expiresAt)) {
      return NextResponse.json({ error: 'Invitacion invalida o expirada' }, { status: 404 });
    }

    return NextResponse.json({
      email: invitation.data.email,
      displayName: invitation.data.displayName,
      orgName: invitation.data.orgName,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, password } = (await req.json()) as { token?: string; password?: string };
    const cleanPassword = String(password || '');
    if (!token || cleanPassword.length < 6) {
      return NextResponse.json({ error: 'La contrasena debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const invitation = await getInvitation(token);
    if (!invitation || invitation.data.status !== 'pending' || invitationExpired(invitation.data.expiresAt)) {
      return NextResponse.json({ error: 'Invitacion invalida o expirada' }, { status: 404 });
    }

    const email = String(invitation.data.email || '').trim().toLowerCase();
    const displayName = String(invitation.data.displayName || '').trim();
    const orgId = String(invitation.data.orgId || '');
    if (!email || !displayName || !orgId) {
      return NextResponse.json({ error: 'Invitacion incompleta' }, { status: 400 });
    }

    const existingProfile = await getUserDocByEmail(email);
    if (existingProfile?.exists) {
      return NextResponse.json({ error: 'Este correo ya tiene un perfil activo.' }, { status: 409 });
    }

    let uid = '';
    try {
      const authUser = await adminAuth.getUserByEmail(email);
      uid = authUser.uid;
      await adminAuth.updateUser(uid, {
        password: cleanPassword,
        displayName,
        emailVerified: true,
        disabled: false,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== 'auth/user-not-found') throw err;
      const userRecord = await adminAuth.createUser({
        email,
        password: cleanPassword,
        displayName,
        emailVerified: true,
        disabled: false,
      });
      uid = userRecord.uid;
    }

    await adminDb.collection('users').doc(uid).set({
      uid,
      email,
      displayName,
      role: 'colaborador',
      orgRole: invitation.data.orgRole || 'miembro',
      organizationId: orgId,
      accountStatus: 'active',
      membership: invitation.data.membership || { type: 'free', expiresAt: '' },
      cliente: orgId,
      mustChangePassword: false,
      createdAt: new Date(),
      active: true,
    }, { merge: true });

    await invitation.ref.update({
      status: 'accepted',
      acceptedAt: new Date(),
      acceptedUid: uid,
    });
    await syncCollaboratorCount(orgId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 });
  }
}
