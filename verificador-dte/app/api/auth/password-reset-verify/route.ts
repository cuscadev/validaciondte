import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { generateTemporaryPassword, sendAppMail, temporaryPasswordEmail } from '@/lib/server-mail';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedCode = String(code || '').trim();
    if (!normalizedEmail || !normalizedCode) {
      return NextResponse.json({ error: 'Correo y codigo requeridos' }, { status: 400 });
    }

    const codeSnap = await adminDb
      .collection('passwordResetCodes')
      .where('code', '==', normalizedCode)
      .limit(10)
      .get();

    const matchingCodeDoc = codeSnap.docs.find((doc) => {
      const data = doc.data();
      return data.email === normalizedEmail && data.used === false;
    });

    if (!matchingCodeDoc) {
      return NextResponse.json({ error: 'Codigo incorrecto' }, { status: 400 });
    }

    const codeDoc = matchingCodeDoc;
    const codeData = codeDoc.data();
    const expiresAt = codeData.expiresAt?.toDate?.() ?? new Date(codeData.expiresAt);
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'El codigo expiro. Solicita uno nuevo.' }, { status: 400 });
    }

    const userSnap = await adminDb.collection('users').where('email', '==', normalizedEmail).limit(1).get();
    if (userSnap.empty) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const userDoc = userSnap.docs[0];
    const temporaryPassword = generateTemporaryPassword();
    const authUser = await adminAuth.getUserByEmail(normalizedEmail);

    await adminAuth.updateUser(authUser.uid, {
      password: temporaryPassword,
      disabled: false,
    });
    await userDoc.ref.update({
      uid: authUser.uid,
      mustChangePassword: true,
      temporaryPasswordIssuedAt: new Date(),
      updatedAt: new Date(),
    });
    await codeDoc.ref.update({ used: true, usedAt: new Date() });

    const emailContent = temporaryPasswordEmail({
      temporaryPassword,
      title: 'Tu contrasena temporal KayDTe',
      intro: 'Tu codigo fue verificado correctamente. Ingresa con esta contrasena temporal para recuperar el acceso.',
    });

    await sendAppMail({
      to: normalizedEmail,
      subject: 'Tu contrasena temporal KayDTe',
      ...emailContent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error restableciendo clave' }, { status: 500 });
  }
}
