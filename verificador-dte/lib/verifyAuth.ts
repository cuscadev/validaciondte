import { adminAuth } from '@/lib/firebase-admin';
import { NextRequest } from 'next/server';

/**
 * Verifies the Firebase idToken from the Authorization header.
 * Returns the uid if valid, or null if missing/invalid.
 */
export async function verifyAuthToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}
