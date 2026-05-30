import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-auth';

async function getUserIdentity(uid: string) {
  const candidates = new Set<string>([uid]);

  const directSnap = await adminDb.collection('users').doc(uid).get();

  if (directSnap.exists) {
    const data = directSnap.data();

    candidates.add(directSnap.id);
    if (data?.firebaseUid) candidates.add(data.firebaseUid);
    if (data?.uid) candidates.add(data.uid);

    return {
      role: data?.role ?? '',
      candidates: Array.from(candidates),
    };
  }

  const firebaseSnap = await adminDb
    .collection('users')
    .where('firebaseUid', '==', uid)
    .limit(1)
    .get();

  if (!firebaseSnap.empty) {
    const doc = firebaseSnap.docs[0];
    const data = doc.data();

    candidates.add(doc.id);
    if (data?.firebaseUid) candidates.add(data.firebaseUid);
    if (data?.uid) candidates.add(data.uid);

    return {
      role: data?.role ?? '',
      candidates: Array.from(candidates),
    };
  }

  return {
    role: '',
    candidates: Array.from(candidates),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { uid, role } = await requireAuth(req);

    const body = (await req.json()) as {
      notificationId?: string;
    };

    if (!body.notificationId) {
      return NextResponse.json(
        { error: 'notificationId requerido' },
        { status: 400 }
      );
    }

    const identity = await getUserIdentity(uid);
    const effectiveRole = role || identity.role;

    const notificationRef = adminDb
      .collection('notifications')
      .doc(body.notificationId);

    const notificationSnap = await notificationRef.get();

    if (!notificationSnap.exists) {
      return NextResponse.json(
        { error: 'Notificación no encontrada' },
        { status: 404 }
      );
    }

    const notification = notificationSnap.data();

    const canRead =
      identity.candidates.includes(notification?.targetUid) ||
      notification?.targetRole === effectiveRole ||
      notification?.targetRole === 'all';

    if (!canRead) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await notificationRef.update({
      readBy: FieldValue.arrayUnion(uid, ...identity.candidates),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marcando notificación como leída:', error);

    return NextResponse.json(
      { error: 'No se pudo marcar la notificación como leída' },
      { status: 500 }
    );
  }
}