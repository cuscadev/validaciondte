import {
  collection,
  addDoc,
  Timestamp,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export type NotificationType =
  | 'access_request'
  | 'membership_expiring'
  | 'admin_message'
  | 'general';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  targetUid?: string;       // Notif para un usuario específico
  targetRole?: string;      // Notif para un rol completo (ej: 'superadmin')
  readBy: string[];         // UIDs que ya la leyeron
  createdAt: { seconds: number; nanoseconds: number };
  createdBy?: string;
  metadata?: Record<string, any>;
}

export interface CreateNotificationParams {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  targetUid?: string;
  targetRole?: string;
  createdBy?: string;
  metadata?: Record<string, any>;
}

/** Crea una notificación en Firestore */
export async function createNotification(params: CreateNotificationParams) {
  await addDoc(collection(db, 'notifications'), {
    ...params,
    readBy: [],
    createdAt: Timestamp.now(),
  });
}

/** Marca una notificación como leída para un UID */
export async function markNotificationRead(notifId: string, uid: string) {
  const token = await auth.currentUser?.getIdToken();
  if (!token || !uid) throw new Error('No autorizado');

  const res = await fetch('/api/notifications/read', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ notificationId: notifId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || 'No se pudo marcar la notificacion como leida');
  }
}

/** Suscripción en tiempo real a notificaciones de un usuario (personales + por rol) */
export function subscribeToNotifications(
  uid: string,
  role: string,
  callback: (notifications: AppNotification[]) => void
) {
  const byUid = query(
    collection(db, 'notifications'),
    where('targetUid', '==', uid)
  );
  const roleQuery = role
    ? query(
        collection(db, 'notifications'),
        where('targetRole', 'in', [role, 'all'])
      )
    : query(
        collection(db, 'notifications'),
        where('targetRole', '==', 'all')
      );

  const map = new Map<string, AppNotification>();

  function merge() {
    const sorted = Array.from(map.values()).sort(
      (a, b) => b.createdAt.seconds - a.createdAt.seconds
    );
    callback(sorted);
  }

  const unsubUid = onSnapshot(byUid, (snap) => {
    console.log('[notifications] byUid snap size:', snap.size);
    snap.docs.forEach((d) =>
      map.set(d.id, { id: d.id, ...d.data() } as AppNotification)
    );
    snap.docChanges().forEach((change) => {
      if (change.type === 'removed') map.delete(change.doc.id);
    });
    merge();
  }, (err) => console.error('[notifications] byUid error:', err));

  const unsubRole = onSnapshot(roleQuery, (snap) => {
    console.log('[notifications] byRole snap size:', snap.size);
    snap.docs.forEach((d) =>
      map.set(d.id, { id: d.id, ...d.data() } as AppNotification)
    );
    snap.docChanges().forEach((change) => {
      if (change.type === 'removed') map.delete(change.doc.id);
    });
    merge();
  }, (err) => console.error('[notifications] byRole error:', err));

  return () => {
    unsubUid();
    unsubRole();
  };
}
