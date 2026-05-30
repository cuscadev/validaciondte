import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { generateSixDigitCode, sendAppMail, verificationCodeEmail } from '@/lib/server-mail';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, email, telefono, mensaje } = body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!nombre || !normalizedEmail || !telefono || !mensaje) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const activeUser = await adminDb.collection('users').where('email', '==', normalizedEmail).limit(1).get();
    if (!activeUser.empty && activeUser.docs[0].data().active !== false) {
      return NextResponse.json({ error: 'Ya existe una cuenta activa con este correo' }, { status: 409 });
    }

    const existingPending = await adminDb
      .collection('accessRequests')
      .where('email', '==', normalizedEmail)
      .where('status', 'in', ['pending_verification', 'pending'])
      .limit(1)
      .get();

    const code = generateSixDigitCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const requestPayload = {
      nombre,
      email: normalizedEmail,
      telefono,
      mensaje,
      createdAt: new Date(),
      status: 'pending_verification',
      verificationCode: code,
      verificationExpiresAt: expiresAt,
      verifiedAt: null,
    };

    const requestRef = existingPending.empty
      ? await adminDb.collection('accessRequests').add(requestPayload)
      : existingPending.docs[0].ref;

    if (!existingPending.empty) {
      await requestRef.set(requestPayload, { merge: true });
    }

    const emailContent = verificationCodeEmail({
      code,
      title: 'Verifica tu solicitud de acceso',
      intro: 'Recibimos tu solicitud para acceder a KayDTe. Ingresa este codigo en la pantalla de verificacion para continuar.',
    });

    await sendAppMail({
      to: normalizedEmail,
      subject: 'Codigo de verificacion KayDTe',
      ...emailContent,
    });

    return NextResponse.json({ success: true, requestId: requestRef.id });
  } catch (error) {
    console.error('Error guardando solicitud:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al guardar la solicitud' }, { status: 500 });
  }
}
