import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { canManageOrgUsers } from '@/lib/firestoreUser';
import { requireAuth } from '@/lib/server-auth';

type Action = 'forceLogout' | 'block' | 'unblock';

async function loadTarget(uid: string) {
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) return null;
  return { uid, ...snap.data() } as {
    uid: string;
    role?: string;
    organizationId?: string;
    email?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAuth(req);
    const { uid, action } = await req.json() as { uid?: string; action?: Action };

    if (!uid || !action) {
      return NextResponse.json({ error: 'Falta uid o accion' }, { status: 400 });
    }

    const isSuperadmin = caller.role === 'superadmin';
    const isOrgManager = canManageOrgUsers(caller);

    if (!isSuperadmin && !isOrgManager) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (uid === caller.uid && action !== 'forceLogout') {
      return NextResponse.json(
        { error: 'No puedes bloquear tu propio usuario.' },
        { status: 400 }
      );
    }

    const target = await loadTarget(uid);
    if (!target) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!isSuperadmin) {
      if (!caller.organizationId || target.organizationId !== caller.organizationId) {
        return NextResponse.json({ error: 'No autorizado para este usuario' }, { status: 403 });
      }
      if (target.role === 'cliente') {
        return NextResponse.json({ error: 'No puedes gestionar al dueño de la organización' }, { status: 403 });
      }
      if (target.role !== 'colaborador') {
        return NextResponse.json({ error: 'Solo puedes gestionar colaboradores' }, { status: 403 });
      }
    }

    const now = new Date();
    const userRef = adminDb.collection('users').doc(uid);

    if (action === 'forceLogout') {
      await adminAuth.revokeRefreshTokens(uid);
      await userRef.set({
        forceLogoutAt: now,
        forceLogoutBy: caller.uid,
        forceLogoutByEmail: caller.email,
        updatedAt: now,
      }, { merge: true });

      return NextResponse.json({ success: true });
    }

    if (action === 'block') {
      await adminAuth.updateUser(uid, { disabled: true });
      await adminAuth.revokeRefreshTokens(uid);
      await userRef.set({
        disabled: true,
        accountStatus: 'blocked',
        blockedAt: now,
        blockedBy: caller.uid,
        blockedByEmail: caller.email,
        forceLogoutAt: now,
        updatedAt: now,
      }, { merge: true });

      return NextResponse.json({ success: true });
    }

    if (action === 'unblock') {
      await adminAuth.updateUser(uid, { disabled: false });
      await userRef.set({
        disabled: false,
        accountStatus: 'active',
        unblockedAt: now,
        unblockedBy: caller.uid,
        unblockedByEmail: caller.email,
        updatedAt: now,
      }, { merge: true });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Accion no valida' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo actualizar el usuario' },
      { status: 500 }
    );
  }
}
