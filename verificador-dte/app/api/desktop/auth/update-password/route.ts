import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    const licenseKey = String(body.licenseKey || '').trim();

    if (!email || !currentPassword || !newPassword || !licenseKey) {
      return NextResponse.json(
        { error: 'email, currentPassword, newPassword y licenseKey son requeridos' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }

    const userSnap = await adminDb.collection('users').where('email', '==', email).limit(1).get();
    if (userSnap.empty) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    const userDoc = userSnap.docs[0];
    const user = userDoc.data();
    if (!user?.password || !(await bcrypt.compare(currentPassword, user.password))) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    const licenseSnap = await adminDb.collection('desktopLicenses').doc(licenseKey).get();
    if (!licenseSnap.exists) {
      return NextResponse.json({ error: 'Licencia inválida' }, { status: 403 });
    }

    const license = licenseSnap.data();
    if (!license?.active) {
      return NextResponse.json({ error: 'Licencia desactivada' }, { status: 403 });
    }

    if (license.userEmail && String(license.userEmail).trim().toLowerCase() !== email) {
      return NextResponse.json({ error: 'Esta licencia no está asignada a este correo' }, { status: 403 });
    }

    if (license.userId && license.userId !== userDoc.id) {
      return NextResponse.json({ error: 'Esta licencia no está asignada a este usuario' }, { status: 403 });
    }

    const expiresAt = license.expiresAt ? new Date(license.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Licencia vencida' }, { status: 403 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userDoc.ref.update({ password: hashedPassword, mustChangePassword: false, updatedAt: new Date() });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error actualizando contraseña' },
      { status: 500 }
    );
  }
}
