import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { generateSixDigitCode, sendAppMail, verificationCodeEmail } from '@/lib/server-mail';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Correo requerido' }, { status: 400 });
    }

    const userSnap = await adminDb.collection('users').where('email', '==', normalizedEmail).limit(1).get();
    if (userSnap.empty) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const code = generateSixDigitCode();
    await adminDb.collection('passwordResetCodes').add({
      email: normalizedEmail,
      uid: userSnap.docs[0].id,
      code,
      used: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const emailContent = verificationCodeEmail({
      code,
      title: 'Codigo para restablecer tu clave',
      intro: 'Usa este codigo para verificar tu identidad y continuar con el restablecimiento de clave.',
    });

    await sendAppMail({
      to: normalizedEmail,
      subject: 'Codigo para restablecer tu clave',
      ...emailContent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error enviando codigo' }, { status: 500 });
  }
}
