import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { generateTemporaryPassword, sendAppMail, temporaryPasswordEmail } from '@/lib/server-mail';
import { requireOrgAdmin } from '@/lib/server-auth';

export async function POST(
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

    const email = String(target.email ?? '');
    const temporaryPassword = generateTemporaryPassword();
    await adminAuth.updateUser(uid, { password: temporaryPassword });
    await adminDb.collection('users').doc(uid).set({
      mustChangePassword: true,
      temporaryPasswordIssuedAt: new Date(),
    }, { merge: true });

    const mail = temporaryPasswordEmail({
      temporaryPassword,
      title: 'Nueva contrasena temporal — Kaiser DTE',
      intro: 'Tu administrador ha restablecido tu contrasena. Usa la clave temporal para ingresar.',
    });
    await sendAppMail({ to: email, subject: 'Nueva contrasena temporal', ...mail });

    return NextResponse.json({ success: true, temporaryPassword });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
