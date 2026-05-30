import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/verifyAuth';

export async function POST(req: NextRequest) {
  try {
    const tokenUid = await verifyAuthToken(req);
    if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { uid } = await req.json() as { uid: string };
    if (!uid) return NextResponse.json({ error: 'uid requerido' }, { status: 400 });
    if (tokenUid !== uid) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    await adminDb.doc(`users/${uid}`).update({
      totpEnabled: false,
      totpSecret: null,
      totpPendingSecret: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('TOTP disable error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
