import { auth } from '@/lib/firebase';

export async function getFirebaseIdToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  await auth.authStateReady();
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}
