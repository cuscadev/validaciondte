import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface AuthIdentity {
  uid: string;
  email: string;
  source: 'firebase' | 'legacy';
}

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...(init?.headers || {}),
    },
  });
}

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

function verifyLegacyToken(token: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    return jwt.verify(token, secret) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getIdentity(req: NextRequest): Promise<AuthIdentity | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email || '',
      source: 'firebase',
    };
  } catch {
    const decoded = verifyLegacyToken(token);
    if (!decoded?.uid) return null;

    return {
      uid: String(decoded.uid),
      email: String(decoded.email || ''),
      source: decoded.authProvider === 'firebase' ? 'firebase' : 'legacy',
    };
  }
}

async function getUserDoc(identity: AuthIdentity) {
  const byUid = await adminDb.collection('users').doc(identity.uid).get();
  if (byUid.exists) return byUid;

  if (!identity.email) return null;

  const byEmail = await adminDb
    .collection('users')
    .where('email', '==', identity.email)
    .limit(1)
    .get();

  return byEmail.empty ? null : byEmail.docs[0];
}

async function verifyFirebasePassword(email: string, password: string) {
  if (!FIREBASE_API_KEY) {
    throw new Error('Falta NEXT_PUBLIC_FIREBASE_API_KEY en el servidor.');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: false,
      }),
    }
  );

  return response.ok;
}

export async function POST(req: NextRequest) {
  try {
    const identity = await getIdentity(req);
    if (!identity) {
      return json({ error: 'No autorizado' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();
    const current = String(currentPassword || '');
    const next = String(newPassword || '');

    if (!current || !next) {
      return json({ error: 'Datos incompletos' }, { status: 400 });
    }

    if (next.length < 6) {
      return json(
        { error: 'La nueva contrasena debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    const userDoc = await getUserDoc(identity);
    if (!userDoc?.exists) {
      return json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    const user = userDoc.data() || {};
    if (user.disabled) {
      return json(
        { error: 'Tu usuario esta bloqueado. Contacta al administrador.' },
        { status: 403 }
      );
    }

    const email = String(user.email || identity.email || '').trim().toLowerCase();
    if (!email) {
      return json({ error: 'El usuario no tiene correo configurado.' }, { status: 400 });
    }

    if (identity.source === 'legacy') {
      if (!user.password) {
        return json({ error: 'La contrasena actual es incorrecta' }, { status: 401 });
      }

      const valid = await bcrypt.compare(current, String(user.password));
      if (!valid) {
        return json({ error: 'La contrasena actual es incorrecta' }, { status: 401 });
      }

      const hashedPassword = await bcrypt.hash(next, 10);
      await userDoc.ref.update({
        password: hashedPassword,
        mustChangePassword: false,
        updatedAt: new Date(),
      });

      return json({ success: true });
    }

    const valid = await verifyFirebasePassword(email, current);
    if (!valid) {
      return json({ error: 'La contrasena actual es incorrecta' }, { status: 401 });
    }

    const updateData: Record<string, unknown> = {
      mustChangePassword: false,
      updatedAt: new Date(),
    };

    if (user.password) {
      updateData.password = await bcrypt.hash(next, 10);
    }

    await adminAuth.updateUser(identity.uid, { password: next });
    await userDoc.ref.update(updateData);

    return json({ success: true });
  } catch (error) {
    console.error('[api/change-password] Error changing password', error);

    return json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
