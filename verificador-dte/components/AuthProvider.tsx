'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onIdTokenChanged, signOut, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { getUser } from '@/lib/firestoreUser';
import { AppUser } from '@/lib/firestoreUser';
import { QUERY_CACHE_MS } from '@/components/QueryProvider';
import { mergeAppUserIfChanged } from '@/lib/profile-equals';
import { isPublicPath } from '@/lib/publicRoutes';
import { clearSessionCookie, setSessionCookie } from '@/lib/session-cookie';

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  authChecked: boolean;
  isAuthenticated: boolean;
  refreshAppUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  appUser: null,
  authChecked: false,
  isAuthenticated: false,
  refreshAppUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function dateValue(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    return maybeTimestamp.toDate?.() ?? null;
  }
  return null;
}

async function getFreshUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? ({ ...(snap.data() as Omit<AppUser, 'uid'>), uid: snap.id }) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const wasAuthenticatedRef = useRef(false);
  const haciendaAuthUidRef = useRef<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const refreshAppUser = useCallback(async () => {
    if (!firebaseUser) return;
    const freshProfile = await getFreshUser(firebaseUser.uid);
    if (freshProfile) {
      setAppUser((prev) => mergeAppUserIfChanged(prev, freshProfile));
      queryClient.setQueryData(['users', firebaseUser.uid], freshProfile);
    }
  }, [firebaseUser, queryClient]);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (user) => {
      if (user) {
        console.info('[auth-provider] Firebase user detected', {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
        });

        // Refresh __session cookie for middleware
        const token = await user.getIdToken();
        setSessionCookie(token);
        wasAuthenticatedRef.current = true;

        // Load Firestore profile (cached after first call)
        const profile = await queryClient.fetchQuery({
          queryKey: ['users', user.uid],
          queryFn: () => getUser(user.uid),
          staleTime: QUERY_CACHE_MS,
          gcTime: QUERY_CACHE_MS,
        });
        console.info('[auth-provider] Firestore profile loaded', {
          uid: user.uid,
          profileFound: !!profile,
          role: profile?.role,
        });
        setFirebaseUser(user);
        setAppUser((prev) => mergeAppUserIfChanged(prev, profile));

        if (profile && haciendaAuthUidRef.current !== user.uid) {
          haciendaAuthUidRef.current = user.uid;
          fetch('/api/hacienda/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ forceRefresh: false }),
          }).catch(() => {
            // Hacienda auth is opportunistic; missing credentials should not block app login.
          });
        }
      } else {
        console.info('[auth-provider] No Firebase user in session', {
          pathname: window.location.pathname,
          wasAuthenticated: wasAuthenticatedRef.current,
        });
        clearSessionCookie();
        setFirebaseUser(null);
        setAppUser(null);
        haciendaAuthUidRef.current = null;
        if (!isPublicPath(window.location.pathname)) {
          if (wasAuthenticatedRef.current) {
            // Session expired — AppShell will show the modal
          } else {
            router.replace('/login');
          }
        }
      }
      setAuthChecked(true);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!firebaseUser) return;

    let active = true;

    const validateSessionState = async () => {
      try {
        const [freshProfile, tokenResult] = await Promise.all([
          getFreshUser(firebaseUser.uid),
          firebaseUser.getIdTokenResult(),
        ]);

        if (!active) return;

        if (!freshProfile || freshProfile.disabled) {
          await signOut(auth);
          clearSessionCookie();
          router.replace('/login');
          return;
        }

        const forceLogoutAt = dateValue(freshProfile.forceLogoutAt);
        const authTime = new Date(tokenResult.authTime);
        if (forceLogoutAt && forceLogoutAt > authTime) {
          await signOut(auth);
          clearSessionCookie();
          router.replace('/login');
          return;
        }

        setAppUser((prev) => mergeAppUserIfChanged(prev, freshProfile));
        queryClient.setQueryData(['users', firebaseUser.uid], freshProfile);
      } catch (error) {
        console.warn('[auth-provider] Session state validation failed', error);
      }
    };

    validateSessionState();
    const timer = window.setInterval(validateSessionState, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [firebaseUser, queryClient, router]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        appUser,
        authChecked,
        isAuthenticated: !!firebaseUser,
        refreshAppUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
