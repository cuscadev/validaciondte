'use client';

import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { ProcessingLogPayload } from '@/lib/processing-log';

async function getCurrentUser(timeoutMs = 3000): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser);
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    });
  });
}

export async function recordProcessingLog(payload: ProcessingLogPayload) {
  try {
    const user = await getCurrentUser();
    const token = await user?.getIdToken();

    if (!token) return;

    await fetch('/api/processing-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...payload,
        userAgent: navigator.userAgent,
      }),
    });
  } catch {
    // Logging must never block the user's result flow.
  }
}
