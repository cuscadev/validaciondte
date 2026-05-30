'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUser } from '@/lib/firestoreUser';
import { QUERY_CACHE_MS } from '@/components/QueryProvider';
import {
  AppNotification,
  markNotificationRead,
  subscribeToNotifications,
} from '@/lib/notifications';

export function useNotifications() {
  const queryClient = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUid(user.uid);
        const appUser = await queryClient.fetchQuery({
          queryKey: ['users', user.uid],
          queryFn: () => getUser(user.uid),
          staleTime: QUERY_CACHE_MS,
          gcTime: QUERY_CACHE_MS,
        });
        const userRole = appUser?.role ?? '';
        console.log('[useNotifications] uid:', user.uid, 'role:', userRole);
        setRole(userRole);
      } else {
        setUid(null);
        setRole('');
        setNotifications([]);
      }
    });
    return () => unsub();
  }, [queryClient]);

  useEffect(() => {
    if (!uid || !role) return;
    console.log('[useNotifications] subscribing uid:', uid, 'role:', role);
    const unsub = subscribeToNotifications(uid, role, (notifs) => {
      console.log('[useNotifications] received notifications:', notifs.length, notifs);
      setNotifications(notifs);
    });
    return () => unsub();
  }, [uid, role]);

  const unread = notifications.filter((n) => !n.readBy.includes(uid ?? ''));

  async function markRead(notifId: string) {
    if (!uid) return;
    await markNotificationRead(notifId, uid);
  }

  async function markAllRead() {
    if (!uid) return;
    await Promise.all(
      unread.map((n) => markNotificationRead(n.id, uid))
    );
  }

  return { notifications, unread, markRead, markAllRead, uid, role };
}
