import { NextRequest, NextResponse } from 'next/server';
import { verifySync } from 'otplib';
import { adminDb } from '@/lib/firebase-admin';
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
    const { uid, code } = await req.json() as { uid: string; code: string };
    if (!uid || !code) return NextResponse.json({ error: 'uid y code requeridos' }, { status: 400 });

    const snap = await adminDb.doc(`users/${uid}`).get();
    const data = snap.data();

    if (!data?.totpEnabled || !data?.totpSecret) {
      return NextResponse.json({ error: 'TOTP no está activado' }, { status: 400 });
    }

    const secret = decrypt(data.totpSecret);
    const result = verifySync({ token: code, secret });
    const isValid = result !== null && result.valid;

    if (!isValid) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error('TOTP validate error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
