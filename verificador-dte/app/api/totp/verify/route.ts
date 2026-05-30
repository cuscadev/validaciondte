import { NextRequest, NextResponse } from 'next/server';
import { verifySync } from 'otplib';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/verifyAuth';
import { createDecipheriv } from 'crypto';

const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY!;

function decrypt(text: string): string {
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function POST(req: NextRequest) {
  try {
    const tokenUid = await verifyAuthToken(req);
    if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { uid, code } = await req.json() as { uid: string; code: string };
    if (!uid || !code) return NextResponse.json({ error: 'uid y code requeridos' }, { status: 400 });
    if (tokenUid !== uid) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const snap = await adminDb.doc(`users/${uid}`).get();
    const data = snap.data();
    if (!data?.totpPendingSecret) {
      return NextResponse.json({ error: 'No hay secreto TOTP pendiente' }, { status: 400 });
    }

    const secret = decrypt(data.totpPendingSecret);
    const result = verifySync({ token: code, secret });
    const isValid = result !== null && result.valid;

    if (!isValid) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
    }

    // Activar TOTP: mover de pending a activo
    await adminDb.doc(`users/${uid}`).update({
      totpEnabled: true,
      totpSecret: data.totpPendingSecret,
      totpPendingSecret: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('TOTP verify error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
