import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    await requireSuperadmin(req);
    const { requestId } = await req.json() as { requestId: string };
    if (!requestId) return NextResponse.json({ error: 'requestId requerido' }, { status: 400 });

    await adminDb.doc(`accessRequests/${requestId}`).update({ status: 'rejected' });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error al rechazar solicitud:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
