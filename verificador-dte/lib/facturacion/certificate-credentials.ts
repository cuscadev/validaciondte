import { adminDb } from '@/lib/firebase-admin';
import { decryptSecret, encryptSecret } from '@/lib/hacienda-crypto';

export async function getStoredCertificatePassword(uid: string) {
  const snap = await adminDb.collection('users').doc(uid).get();
  const encrypted = snap.data()?.facturacion?.certificatePasswordEncrypted;
  if (typeof encrypted !== 'string' || !encrypted.trim()) return '';
  return decryptSecret(encrypted);
}

export async function saveCertificatePassword(uid: string, password: string) {
  await adminDb.collection('users').doc(uid).set(
    {
      facturacion: {
        certificatePasswordEncrypted: encryptSecret(password),
        certificatePasswordUpdatedAt: new Date(),
      },
    },
    { merge: true }
  );
}

export async function resolveCertificatePassword(uid: string, provided?: unknown) {
  const password = String(provided || '').trim();
  return password || await getStoredCertificatePassword(uid);
}
