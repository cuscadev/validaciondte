import { NextRequest, NextResponse } from 'next/server';
import { generateSecret, generateURI } from 'otplib';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/verifyAuth';
import { createCipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY!; // 32 bytes hex → 64 chars

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export async function POST(req: NextRequest) {
  try {
    const tokenUid = await verifyAuthToken(req);
    if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { uid, email } = await req.json() as { uid: string; email: string };
    if (!uid || !email) return NextResponse.json({ error: 'uid y email requeridos' }, { status: 400 });
    if (tokenUid !== uid) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const secret = generateSecret();
    const otpauthUrl = generateURI({ secret, label: email, issuer: 'Kaiser DTE', strategy: 'totp' });

    // Guardar secreto pendiente cifrado (no activo hasta verificar)
    const encryptedSecret = encrypt(secret);
    await adminDb.doc(`users/${uid}`).update({
      totpPendingSecret: encryptedSecret,
    });

    return NextResponse.json({ otpauthUrl });
  } catch (err) {
    console.error('TOTP generate error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
