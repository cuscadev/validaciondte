import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// Solo un admin o el propio usuario puede cambiar la contraseña
export async function POST(req: NextRequest) {
  const { email, newPassword, requesterRole, requesterEmail } = await req.json();
  if (!email || !newPassword) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }
  // Busca usuario
  const userSnap = await adminDb.collection('users').where('email', '==', email).get();
  if (userSnap.empty) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }
  const userDoc = userSnap.docs[0];
  // Permitir solo si es admin, cliente, o el propio usuario
  if (
    requesterRole !== 'admin' &&
    requesterRole !== 'cliente' &&
    requesterEmail !== email
  ) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const authUser = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(authUser.uid, { password: newPassword });
    await userDoc.ref.update({
      uid: authUser.uid,
      updatedAt: new Date(),
    });
  } catch (error) {
    const authError = error as { code?: string; message?: string };
    if (authError.code === 'auth/user-not-found') {
      const data = userDoc.data();
      const userRecord = await adminAuth.createUser({
        uid: userDoc.id,
        email,
        password: newPassword,
        displayName: data.displayName || email,
        emailVerified: false,
        disabled: false,
      });

      await userDoc.ref.update({
        uid: userRecord.uid,
        active: true,
        updatedAt: new Date(),
      });

      return NextResponse.json({ success: true, migrated: true });
    }

    return NextResponse.json({ error: authError.message || 'Error al cambiar contraseña' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
