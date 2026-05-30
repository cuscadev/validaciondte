import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/server-auth';
import { sendAppMail, smtpTestEmail } from '@/lib/server-mail';

export async function GET(req: NextRequest) {
  try {
    await requireSuperadmin(req);
    const snap = await adminDb.collection('config').doc('smtp').get();
    const data = snap.data();

    if (!data) {
      return NextResponse.json({ smtp: null });
    }

    return NextResponse.json({
      smtp: {
        ...data,
        password: data.password ? '********' : '',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No autorizado' }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSuperadmin(req);
    const body = await req.json();
    const { host, port, secure, user, password, fromEmail, fromName, enabled, testEmail } = body;

    if (!host || !port || !user || !fromEmail) {
      return NextResponse.json({ error: 'Host, puerto, usuario y remitente son obligatorios.' }, { status: 400 });
    }

    const ref = adminDb.collection('config').doc('smtp');
    const current = (await ref.get()).data();
    const nextPassword = password && password !== '********' ? password : current?.password;

    if (!nextPassword) {
      return NextResponse.json({ error: 'La contrasena SMTP es obligatoria.' }, { status: 400 });
    }

    const smtp = {
      host: String(host).trim(),
      port: Number(port),
      secure: Boolean(secure),
      user: String(user).trim(),
      password: String(nextPassword),
      fromEmail: String(fromEmail).trim(),
      fromName: String(fromName || 'KayDTe').trim(),
      enabled: Boolean(enabled),
      updatedAt: new Date(),
    };

    await ref.set(smtp, { merge: true });

    if (testEmail) {
      const emailContent = smtpTestEmail();
      await sendAppMail({
        to: String(testEmail).trim(),
        subject: 'Prueba SMTP KayDTe',
        ...emailContent,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error guardando SMTP' }, { status: 500 });
  }
}
