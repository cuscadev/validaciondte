import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

interface FirebaseAdminCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function getEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizePrivateKey(value: string) {
  const normalized = value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .trim();

  if (
    !normalized.startsWith('-----BEGIN PRIVATE KEY-----') ||
    !normalized.includes('-----END PRIVATE KEY-----')
  ) {
    throw new Error(
      'Invalid FIREBASE_PRIVATE_KEY value: no se encontró un PEM válido. ' +
      'Asegúrate de subir la clave privada completa, sin caracteres adicionales, con el bloque `-----BEGIN PRIVATE KEY-----` y `-----END PRIVATE KEY-----`.'
    );
  }

  return normalized;
}

function parseServiceAccountJson(value: string) {
  const candidates = [value.trim()];

  try {
    candidates.push(Buffer.from(value.trim(), 'base64').toString('utf8').trim());
  } catch {
    // The plain JSON candidate below will report the actual parse error.
  }

  let lastError: unknown;

  for (const candidate of candidates) {
    if (!candidate || (!candidate.startsWith('{') && !candidate.endsWith('}'))) {
      continue;
    }

    try {
      return JSON.parse(candidate) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(
    'El valor debe ser el JSON completo de la cuenta de servicio, incluyendo las llaves { } inicial y final.'
  );
}

function getServiceAccountCredentials(): FirebaseAdminCredentials {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (serviceAccountJson && serviceAccountJson !== '{}') {
    try {
      const credentials = parseServiceAccountJson(serviceAccountJson);

      if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
        throw new Error('El JSON no contiene project_id, client_email y private_key.');
      }

      return {
        projectId: credentials.project_id,
        clientEmail: credentials.client_email,
        privateKey: normalizePrivateKey(credentials.private_key),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'JSON invalido.';
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON value: ${message}`);
    }
  }

  return {
    projectId: getEnv('FIREBASE_PROJECT_ID'),
    clientEmail: getEnv('FIREBASE_CLIENT_EMAIL'),
    privateKey: normalizePrivateKey(getEnv('FIREBASE_PRIVATE_KEY')),
  };
}

const firebaseCredentials = getServiceAccountCredentials();

const app = !getApps().length
  ? initializeApp({
      credential: cert(firebaseCredentials),
    })
  : getApp();

const adminDb = getFirestore(app);
const adminAuth = getAuth(app);

export { adminDb, adminAuth };
