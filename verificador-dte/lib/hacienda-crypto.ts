import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getSecret() {
  const secret =
    process.env.HACIENDA_CREDENTIALS_ENCRYPTION_KEY ||
    process.env.TOTP_ENCRYPTION_KEY ||
    process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('Falta HACIENDA_CREDENTIALS_ENCRYPTION_KEY');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecret(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string) {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getSecret(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}
