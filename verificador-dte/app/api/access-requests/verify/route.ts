import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { requestId, code } = await req.json();
    if (!requestId || !code) {
      return NextResponse.json({ error: 'Codigo requerido' }, { status: 400 });
    }

    const ref = adminDb.collection('accessRequests').doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    const data = snap.data()!;
    const expiresAt = data.verificationExpiresAt?.toDate?.() ?? new Date(data.verificationExpiresAt);
    if (data.status !== 'pending_verification') {
      return NextResponse.json({ error: 'La solicitud ya fue verificada.' }, { status: 400 });
    }
    if (data.verificationCode !== String(code).trim()) {
      return NextResponse.json({ error: 'Codigo incorrecto.' }, { status: 400 });
    }
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'El codigo expiro. Solicita uno nuevo.' }, { status: 400 });
    }

    await ref.update({
      status: 'pending',
      verifiedAt: new Date(),
      verificationCode: null,
      verificationExpiresAt: null,
    });

    await adminDb.collection('notifications').add({
      type: 'access_request',
      title: 'Nueva solicitud de acceso',
      body: `${data.nombre} (${data.email}) ha verificado su correo y solicita acceso.`,
      link: '/admin/access-requests',
      targetRole: 'superadmin',
      readBy: [],
      createdAt: Timestamp.now(),
      metadata: { nombre: data.nombre, email: data.email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error verificando codigo' }, { status: 500 });
  }
}
