import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { adminDb } from '@/lib/firebase-admin';

const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET environment variable');
}

function parseExpiration(value: any): Date | null {
  if (!value) return null;
  if (typeof value === 'string') return new Date(value);
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const licenseKey = String(body.licenseKey || '').trim();
  const deviceId = String(body.deviceId || '').trim();

  if (!email || !password || !licenseKey || !deviceId) {
    return NextResponse.json(
      { error: 'email, password, licenseKey y deviceId son requeridos' },
      { status: 400 }
    );
  }

  const userSnap = await adminDb.collection('users').where('email', '==', email).limit(1).get();
  if (userSnap.empty) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
  }

  const userDoc = userSnap.docs[0];
  const user = userDoc.data();

  if (!user?.password || !(await bcrypt.compare(password, user.password))) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
  }

  const licenseRef = adminDb.collection('desktopLicenses').doc(licenseKey);
  const licenseSnap = await licenseRef.get();
  if (!licenseSnap.exists) {
    return NextResponse.json({ error: 'Licencia inválida' }, { status: 401 });
  }

  const license = licenseSnap.data();
  if (!license?.active) {
    return NextResponse.json({ error: 'Licencia desactivada' }, { status: 403 });
  }

  const expiresAt = parseExpiration(license.expiresAt);
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Licencia vencida' }, { status: 403 });
  }

  if (license.userId && license.userId !== userDoc.id) {
    return NextResponse.json({ error: 'Licencia asignada a otro usuario' }, { status: 403 });
  }

  const deviceRef = adminDb.collection('desktopDevices').doc(deviceId);
  const deviceSnap = await deviceRef.get();

  if (!deviceSnap.exists) {
    return NextResponse.json({ error: 'Dispositivo no registrado. Usa /api/desktop/auth/login para registrarlo primero.' }, { status: 403 });
  }

  const device = deviceSnap.data();
  if (device?.licenseKey !== licenseKey) {
    return NextResponse.json({ error: 'Dispositivo autorizado con otra licencia' }, { status: 403 });
  }
  if (device?.authorized === false) {
    return NextResponse.json({ error: 'Dispositivo bloqueado' }, { status: 403 });
  }

  await deviceRef.update({
    lastSeen: new Date(),
    updatedAt: new Date(),
  });

  const token = jwt.sign(
    {
      type: 'desktop',
      uid: userDoc.id,
      email: user.email,
      role: user.role,
      licenseKey,
      deviceId,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return NextResponse.json({
    token,
    user: {
      uid: userDoc.id,
      email: user.email,
      role: user.role,
    },
    license: {
      licenseKey,
      active: true,
      expiresAt: expiresAt?.toISOString() || null,
    },
    device: {
      deviceId,
    },
  });
}
