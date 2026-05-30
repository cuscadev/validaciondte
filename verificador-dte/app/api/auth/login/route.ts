import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { adminDb } from '@/lib/firebase-admin';
import { getUserDocByEmail } from '@/lib/server-users';

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
      email: string;
    },
  };
}

async function signInWithLegacyPassword(email: string, password: string) {
  const userDoc = await getUserDocByEmail(email);

  if (!userDoc) {
    return null;
  }

  const user = userDoc.data() || {};

  if (!user.password) {
    return null;
  }

  const valid = await bcrypt.compare(password, String(user.password));

  if (!valid) {
    return null;
  }

  if (!JWT_SECRET) {
    throw new Error('Falta JWT_SECRET en el servidor.');
  }

  const uid = userDoc.id;
  const token = jwt.sign(
    {
      uid,
      email: user.email || email,
      role: user.role || null,
      authProvider: 'legacy',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    uid,
    user,
  };
}

function signServerToken(payload: {
  uid: string;
  email: string;
  role?: string | null;
  authProvider: 'firebase' | 'legacy';
}) {
  if (!JWT_SECRET) {
    throw new Error('Falta JWT_SECRET en el servidor.');
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return json({ error: 'Datos incompletos' }, { status: 400 });
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

      if (legacyResult) {
        const { token, uid, user } = legacyResult;

        if (user.disabled) {
          return json(
            { error: 'Tu usuario esta bloqueado. Contacta al administrador.' },
            { status: 403 }
          );
        }

        const totpEnabled = Boolean(user.totpEnabled || user.totpSecret);

        if (totpEnabled) {
          return json({
            uid,
            email: user.email || normalizedEmail,
            totpEnabled: true,
          });
        }

        return json({
          token,
          uid,
          email: user.email || normalizedEmail,
          role: user.role || null,
          mustChangePassword: Boolean(user.mustChangePassword),
          totpEnabled: false,
        });
      }

      return json(
        { error: authResult.error },
        { status: authResult.status }
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

    if (user.disabled) {
      return json(
        { error: 'Tu usuario esta bloqueado. Contacta al administrador.' },
        { status: 403 }
      );
    }

    const totpEnabled = Boolean(user.totpEnabled);

    if (totpEnabled) {
      return json({
        uid: localId,
        email: user.email || normalizedEmail,
        totpEnabled: true,
      });
    }

    const serverToken = signServerToken({
      uid: userDoc.id,
      email: user.email || normalizedEmail,
      role: user.role || null,
      authProvider: 'firebase',
    });

    return json({
      token: serverToken,
      sessionToken: serverToken,
      idToken,
      refreshToken,
      expiresIn,
      uid: userDoc.id,
      email: user.email || normalizedEmail,
      role: user.role || null,
      mustChangePassword: Boolean(user.mustChangePassword),
      totpEnabled: false,
    });
  } catch (error) {
    console.error('[api/auth/login] Login failed', error);

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
