import { adminDb } from '@/lib/firebase-admin';
import { decryptSecret, encryptSecret } from '@/lib/hacienda-crypto';

type HaciendaSettings = {
  nit?: string;
  passwordEncrypted?: string;
  tokenEncrypted?: string;
  tokenExpiresAt?: FirebaseFirestore.Timestamp | Date | null;
  tokens?: Partial<Record<'test' | 'production', {
    tokenEncrypted?: string;
    tokenExpiresAt?: FirebaseFirestore.Timestamp | Date | null;
  }>>;
  environment?: 'test' | 'production';
};

function getEnvironment(value?: string): 'test' | 'production' {
  return value === 'production' ? 'production' : 'test';
}

export function getHaciendaAuthUrl(environment?: string) {
  const env = getEnvironment(environment || process.env.HACIENDA_ENV);
  if (env === 'production') {
    return process.env.HACIENDA_AUTH_URL_PROD || 'https://api.dtes.mh.gob.sv/seguridad/auth';
  }
  return process.env.HACIENDA_AUTH_URL_TEST || 'https://apitest.dtes.mh.gob.sv/seguridad/auth';
}

function getUserAgent() {
  return process.env.HACIENDA_USER_AGENT || 'KaiserDTE';
}

function normalizeToken(token: string) {
  // Return token exactly as received from Hacienda, without any modifications
  // Hacienda API expects the raw token without "Bearer " prefix
  return token.trim();
}

function tokenExp(token: string) {
  const raw = token.replace(/^Bearer\s+/i, '').trim() || token.trim();
  const [, payload] = raw.split('.');
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8')) as { exp?: number };
    return json.exp ? new Date(json.exp * 1000) : null;
  } catch {
    return null;
  }
}

function isTokenFresh(tokenInfo?: {
  tokenEncrypted?: string;
  tokenExpiresAt?: FirebaseFirestore.Timestamp | Date | null;
}) {
  const expiresAt = tokenInfo?.tokenExpiresAt;
  const expiresDate =
    expiresAt && typeof (expiresAt as FirebaseFirestore.Timestamp).toDate === 'function'
      ? (expiresAt as FirebaseFirestore.Timestamp).toDate()
      : expiresAt instanceof Date
        ? expiresAt
        : null;

  return Boolean(tokenInfo?.tokenEncrypted && expiresDate && expiresDate.getTime() > Date.now() + 60_000);
}

export async function getHaciendaTokenForUser(
  uid: string,
  forceRefresh = false,
  environment?: 'test' | 'production'
) {
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const settings = (userSnap.data()?.hacienda || {}) as HaciendaSettings;
  const env = getEnvironment(environment || settings.environment || process.env.HACIENDA_ENV);
  const tokenInfo = settings.tokens?.[env] || {
    tokenEncrypted: settings.tokenEncrypted,
    tokenExpiresAt: settings.tokenExpiresAt,
  };

  if (!settings.nit || !settings.passwordEncrypted) {
    throw new Error('Configura NIT y contrasena de Hacienda en Configuraciones.');
  }

  if (!forceRefresh && isTokenFresh(tokenInfo)) {
    const cachedToken = decryptSecret(tokenInfo.tokenEncrypted!);
    // Always normalize token to remove "Bearer" prefix if present
    return normalizeToken(cachedToken);
  }

  const password = decryptSecret(settings.passwordEncrypted);
  const form = new URLSearchParams();
  form.set('user', settings.nit);
  form.set('pwd', password);

  const res = await fetch(getHaciendaAuthUrl(env), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': getUserAgent(),
    },
    body: form.toString(),
  });

  const payload = await res.json().catch(() => null) as {
    status?: string;
    body?: { token?: string; tokenType?: string; user?: string };
    message?: string;
  } | null;

  const token = payload?.body?.token;
  if (!res.ok || payload?.status !== 'OK' || !token) {
    await userRef.set({
      hacienda: {
        lastAuthStatus: 'error',
        lastAuthError: payload?.message || 'No se pudo autenticar con Hacienda',
        lastAuthEnvironment: env,
        lastAuthAt: new Date(),
      },
    }, { merge: true });

    throw new Error(payload?.message || 'No se pudo autenticar con Hacienda');
  }

  const normalizedToken = normalizeToken(token);
  const expiresAt = tokenExp(normalizedToken) || new Date(Date.now() + 55 * 60 * 1000);

  await userRef.set({
    hacienda: {
      environment: env,
      [`tokens.${env}.tokenEncrypted`]: encryptSecret(normalizedToken),
      [`tokens.${env}.tokenExpiresAt`]: expiresAt,
      tokenEncrypted: encryptSecret(normalizedToken),
      tokenExpiresAt: expiresAt,
      lastAuthStatus: 'ok',
      lastAuthError: '',
      lastAuthEnvironment: env,
      lastAuthAt: new Date(),
      updatedAt: new Date(),
    },
  }, { merge: true });

  return normalizedToken;
}
