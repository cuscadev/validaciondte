import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { adminDb } from '@/lib/firebase-admin';
import { getUserDocByEmail } from '@/lib/server-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...(init?.headers || {}),
    },
  });
}

function getAuthErrorMessage(code?: string) {
  switch (code) {
    case 'EMAIL_NOT_FOUND':
    case 'INVALID_PASSWORD':
    case 'INVALID_LOGIN_CREDENTIALS':
    case 'INVALID_CREDENTIALS':
      return 'Usuario o contrasena incorrectos';
    case 'USER_DISABLED':
      return 'Tu usuario esta bloqueado. Contacta al administrador.';
    case 'INVALID_EMAIL':
      return 'Ingresa un correo electronico valido.';
    default:
      return 'No se pudo iniciar sesion.';
  }
}

async function signInWithFirebasePassword(email: string, password: string) {
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
        returnSecureToken: true,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const code = data?.error?.message;
    const status = code === 'USER_DISABLED' ? 403 : 401;

    return {
      ok: false as const,
      status,
      error: getAuthErrorMessage(code),
    };
  }

  return {
    ok: true as const,
    data: data as {
      idToken: string;
      refreshToken: string;
      expiresIn: string;
      localId: string;
    },
  };
}

function signMobileToken(payload: {
  uid: string;
  email: string;
  role?: string | null;
  authProvider: 'firebase' | 'legacy';
}) {
  if (!JWT_SECRET) {
    throw new Error('Falta JWT_SECRET en el servidor.');
  }

  return jwt.sign({ ...payload, type: 'mobile' }, JWT_SECRET, { expiresIn: '7d' });
}

async function signInWithLegacyPassword(email: string, password: string) {
  const userDoc = await getUserDocByEmail(email);

  if (!userDoc) return null;

  const user = userDoc.data() || {};
  if (!user.password) return null;

  const valid = await bcrypt.compare(password, String(user.password));
  if (!valid) return null;

  return {
    uid: userDoc.id,
    user,
  };
}

function userResponse(params: {
  token: string;
  uid: string;
  email: string;
  role?: string | null;
  mustChangePassword?: boolean;
  authProvider: 'firebase' | 'legacy';
  idToken?: string;
  refreshToken?: string;
  expiresIn?: string;
}) {
  return {
    token: params.token,
    sessionToken: params.token,
    idToken: params.idToken,
    refreshToken: params.refreshToken,
    expiresIn: params.expiresIn,
    uid: params.uid,
    email: params.email,
    role: params.role || null,
    mustChangePassword: Boolean(params.mustChangePassword),
    authProvider: params.authProvider,
    tokenType: 'Bearer',
  };
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return json({ error: 'email y password son requeridos' }, { status: 400 });
    }

    const authResult = await signInWithFirebasePassword(
      normalizedEmail,
      String(password)
    );

    if (!authResult.ok) {
      const legacyResult = await signInWithLegacyPassword(
        normalizedEmail,
        String(password)
      );

      if (!legacyResult) {
        return json({ error: authResult.error }, { status: authResult.status });
      }

      const { uid, user } = legacyResult;

      if (user.disabled || user.active === false) {
        return json(
          { error: 'Tu usuario esta bloqueado. Contacta al administrador.' },
          { status: 403 }
        );
      }

      const token = signMobileToken({
        uid,
        email: String(user.email || normalizedEmail),
        role: String(user.role || ''),
        authProvider: 'legacy',
      });

      return json(
        userResponse({
          token,
          uid,
          email: String(user.email || normalizedEmail),
          role: String(user.role || ''),
          mustChangePassword: Boolean(user.mustChangePassword),
          authProvider: 'legacy',
        })
      );
    }

    const { idToken, refreshToken, expiresIn, localId } = authResult.data;
    let userDoc = await adminDb.collection('users').doc(localId).get();

    if (!userDoc.exists) {
      const emailDoc = await getUserDocByEmail(normalizedEmail);
      if (emailDoc) userDoc = emailDoc;
    }

    if (!userDoc.exists) {
      return json(
        { error: 'No encontramos tu perfil de usuario. Contacta al administrador.' },
        { status: 403 }
      );
    }

    const user = userDoc.data() || {};

    if (user.disabled || user.active === false) {
      return json(
        { error: 'Tu usuario esta bloqueado. Contacta al administrador.' },
        { status: 403 }
      );
    }

    const token = signMobileToken({
      uid: localId,
      email: String(user.email || normalizedEmail),
      role: String(user.role || ''),
      authProvider: 'firebase',
    });

    return json(
      userResponse({
        token,
        idToken,
        refreshToken,
        expiresIn,
        uid: localId,
        email: String(user.email || normalizedEmail),
        role: String(user.role || ''),
        mustChangePassword: Boolean(user.mustChangePassword),
        authProvider: 'firebase',
      })
    );
  } catch (error) {
    console.error('[api/mobile/auth/login] Login failed', error);

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
