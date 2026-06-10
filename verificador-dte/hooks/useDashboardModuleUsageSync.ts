'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { resolveOrganizationId } from '@/lib/firestoreUser';
import { invalidateDashboardStats } from '@/lib/query-client-registry';

const DEBOUNCE_MS = 300;

function createSnapshotHandler(
  key: string,
  initialized: MutableRefObject<Set<string>>,
  scheduleInvalidate: () => void
) {
  return () => {
    if (!initialized.current.has(key)) {
      initialized.current.add(key);
      return;
    }
    scheduleInvalidate();
  };
}

export function useDashboardModuleUsageSync() {
  const { authChecked, isAuthenticated, appUser } = useAuth();
  const initialized = useRef(new Set<string>());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initialized.current = new Set();

    if (!authChecked || !isAuthenticated || !appUser?.uid) {
      return;
    }

    const uid = appUser.uid;
    const organizationId = resolveOrganizationId(appUser);

    const scheduleInvalidate = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        invalidateDashboardStats();
      }, DEBOUNCE_MS);
    };

    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'config', 'plans'),
        createSnapshotHandler('plans', initialized, scheduleInvalidate)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        createSnapshotHandler('user', initialized, scheduleInvalidate)
      )
    );

    if (organizationId) {
      unsubs.push(
        onSnapshot(
          doc(db, 'organizations', organizationId),
          createSnapshotHandler('organization', initialized, scheduleInvalidate)
        )
      );
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [authChecked, isAuthenticated, appUser?.uid, appUser?.organizationId, appUser?.role]);
}
