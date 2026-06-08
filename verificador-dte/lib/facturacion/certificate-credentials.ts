import { adminDb } from '@/lib/firebase-admin';
import { decryptSecret } from '@/lib/hacienda-crypto';

export async function getStoredCertificatePassword(uid: string) {
  const snap = await adminDb.collection('users').doc(uid).get();
  const encrypted = snap.data()?.facturacion?.certificatePasswordEncrypted;
  if (typeof encrypted !== 'string' || !encrypted) return '';
  return decryptSecret(encrypted);
}

export async function resolveCertificatePassword(uid: string, provided?: unknown) {
  const password = String(provided || '').trim();
  return password || await getStoredCertificatePassword(uid);
}
