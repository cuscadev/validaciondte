import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface AuthIdentity {
  uid: string;
  email: string;
  role: string;
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
      role: String(decoded.role || ''),
    };
  } catch {
    const decoded = verifyLegacyToken(token);
    if (!decoded?.uid) return null;

    return {
      uid: String(decoded.uid),
      email: String(decoded.email || ''),
      role: String(decoded.role || ''),
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

export async function GET(req: NextRequest) {
  try {
    const identity = await getIdentity(req);
    if (!identity) {
      return json({ error: 'No autorizado' }, { status: 401 });
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

    return json({
      user: {
        uid: userDoc.id,
        email: user.email || identity.email,
        displayName: user.displayName || '',
        phoneNumber: user.phoneNumber || '',
        company: user.company || '',
        role: user.role || identity.role || '',
        photoURL: user.photoURL || '',
      },
    });
  } catch (error) {
    console.error('[api/profile] Error loading profile', error);

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
