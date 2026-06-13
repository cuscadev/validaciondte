import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { syncAppUserAfterFirestoreWrite } from '@/lib/server-user-sync';

export async function POST(req: NextRequest) {
  const { email, password, displayName, role } = await req.json();
  if (!email || !password || !displayName || !role) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  try {
    const existing = await adminAuth.getUserByEmail(email);
    const userDoc = await adminDb.collection('users').doc(existing.uid).get();

    if (userDoc.exists) {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 });
    }

    await adminDb.collection('users').doc(existing.uid).set({
      uid: existing.uid,
      email,
      displayName,
      role,
      membership: {
        type: 'free',
        expiresAt: '',
      },
      createdAt: new Date(),
      active: true,
      totpEnabled: false,
    });

    await syncAppUserAfterFirestoreWrite(existing.uid);

    return NextResponse.json({ uid: existing.uid });
  } catch (error) {
    const authError = error as { code?: string; message?: string };
    if (authError.code !== 'auth/user-not-found') {
      return NextResponse.json({ error: authError.message || 'Error creando usuario' }, { status: 500 });
    }
  }

  const userRecord = await adminAuth.createUser({
    email,
    displayName,
    password,
    emailVerified: false,
    disabled: false,
  });

  await adminDb.collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid,
    email,
    displayName,
    role,
    membership: {
      type: 'free',
      expiresAt: '',
    },
    createdAt: new Date(),
    active: true,
    totpEnabled: false,
  });

  await syncAppUserAfterFirestoreWrite(userRecord.uid);

  return NextResponse.json({ uid: userRecord.uid });
}
