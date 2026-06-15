import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

const ENCRYPTION_ENV_KEYS = [
  'HACIENDA_CREDENTIALS_ENCRYPTION_KEY',
  'TOTP_ENCRYPTION_KEY',
  'JWT_SECRET',
] as const;

function deriveKey(secret: string) {
  return crypto.createHash('sha256').update(secret).digest();
}

function getEncryptionSecrets() {
  const secrets = ENCRYPTION_ENV_KEYS
    .map((key) => process.env[key]?.trim())
    .filter((value): value is string => Boolean(value));

  if (!secrets.length) {
    throw new Error(
      'Falta configurar HACIENDA_CREDENTIALS_ENCRYPTION_KEY, TOTP_ENCRYPTION_KEY o JWT_SECRET.'
    );
  }

  return secrets;
}

function getPrimaryKey() {
  return deriveKey(getEncryptionSecrets()[0]);
}

function isDecryptAuthError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('unable to authenticate data') ||
    message.includes('unsupported state') ||
    message.includes('bad decrypt')
  );
}

function decryptWithKey(payload: string, key: Buffer) {
  const raw = Buffer.from(payload, 'base64');
  if (raw.length < 29) {
    throw new Error('Credencial cifrada invalida.');
  }

  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getPrimaryKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string) {
  const keys = getEncryptionSecrets().map(deriveKey);
  let lastAuthError: Error | null = null;

  for (const key of keys) {
    try {
      return decryptWithKey(payload, key);
    } catch (error) {
      if (!isDecryptAuthError(error)) {
        throw error;
      }
      lastAuthError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new Error(
    'No se pudo descifrar la credencial guardada. La clave de encriptacion del servidor cambio o los datos estan corruptos. Ve a Configuraciones y vuelve a guardar la contrasena del certificado y/o de Hacienda.',
    { cause: lastAuthError }
  );
}
