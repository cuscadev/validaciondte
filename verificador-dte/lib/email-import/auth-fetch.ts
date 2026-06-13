import { getFirebaseIdToken } from '@/lib/firebase-id-token';

export async function authFetch(url: string, init?: RequestInit) {
  const token = await getFirebaseIdToken();
  if (!token) throw new Error('Inicia sesion para continuar.');
  return fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}
