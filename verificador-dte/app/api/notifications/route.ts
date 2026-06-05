import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { requireAuth, requireSuperadmin } from '@/lib/server-auth';

async function getUserIdentity(uid: string) {
  const candidates = new Set<string>([uid]);

  const directSnap = await adminDb.collection('users').doc(uid).get();

  if (directSnap.exists) {
    const data = directSnap.data();
    candidates.add(directSnap.id);
    if (data?.firebaseUid) candidates.add(data.firebaseUid);
    if (data?.uid) candidates.add(data.uid);

    return {
      userDocId: directSnap.id,
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
      userDocId: doc.id,
      role: data?.role ?? '',
      candidates: Array.from(candidates),
    };
  }

  return {
    userDocId: uid,
    role: '',
    candidates: Array.from(candidates),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { uid, role } = await requireAuth(req);

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');
    const targetRole = searchParams.get('role');
    const scope = searchParams.get('scope');

    if (role === 'superadmin' && mode === 'users') {
      let usersQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
        adminDb.collection('users');

      if (targetRole && targetRole !== 'all') {
        usersQuery = usersQuery.where('role', '==', targetRole);
      }

      const usersSnap = await usersQuery.get();

      const users = usersSnap.docs
        .map((doc) => {
          const data = doc.data();

          return {
            id: doc.id,
            uid: data.firebaseUid || data.uid || doc.id,
            docId: doc.id,
            firebaseUid: data.firebaseUid || '',
            email: data.email || '',
            role: data.role || '',
            displayName:
              data.displayName ||
              data.name ||
              data.nombre ||
              data.email ||
              doc.id,
          };
        })
        .sort((a, b) => a.email.localeCompare(b.email));

      return NextResponse.json({ users });
    }

    if (role === 'superadmin' && scope !== 'me') {
      const notificationsSnap = await adminDb
        .collection('notifications')
        .orderBy('createdAt', 'desc')
        .limit(300)
        .get();

      const notifications = notificationsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return NextResponse.json({ notifications });
    }

    const identity = await getUserIdentity(uid);
    const effectiveRole = role || identity.role;

    const queries: Promise<FirebaseFirestore.QuerySnapshot>[] = [];

    for (const candidateUid of identity.candidates) {
      queries.push(
        adminDb
          .collection('notifications')
          .where('targetUid', '==', candidateUid)
          .get()
      );
    }

    if (effectiveRole) {
      queries.push(
        adminDb
          .collection('notifications')
          .where('targetRole', 'in', [effectiveRole, 'all'])
          .get()
      );
    } else {
      queries.push(
        adminDb
          .collection('notifications')
          .where('targetRole', '==', 'all')
          .get()
      );
    }

    const snaps = await Promise.all(queries);
    const map = new Map<string, any>();

    snaps.forEach((snap) => {
      snap.docs.forEach((doc) => {
        map.set(doc.id, {
          id: doc.id,
          ...doc.data(),
        });
      });
    });

    const notifications = Array.from(map.values()).sort((a, b) => {
      const aSeconds = a.createdAt?.seconds ?? 0;
      const bSeconds = b.createdAt?.seconds ?? 0;
      return bSeconds - aSeconds;
    });

    return NextResponse.json({ notifications });
  } catch (error: any) {
    console.error('Error obteniendo notificaciones:', error);

    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid: authorUid } = await requireSuperadmin(req);

    const body = await req.json();

    const {
      type,
      title,
      body: msgBody,
      link,
      targetUid,
      targetRole,
      createdBy,
      metadata,
    } = body;

    if (!type || !title || !msgBody) {
      return NextResponse.json(
        { error: 'Faltan campos: type, title, body' },
        { status: 400 }
      );
    }

    if (!targetUid && !targetRole) {
      return NextResponse.json(
        { error: 'Debe especificar targetUid o targetRole' },
        { status: 400 }
      );
    }

    const baseNotificationData: Record<string, unknown> = {
      type,
      title,
      body: msgBody,
      ...(link && { link }),
      ...(targetRole && { targetRole }),
      readBy: [],
      createdAt: Timestamp.now(),
      createdBy: createdBy || authorUid,
      ...(metadata && { metadata }),
    };

    if (Array.isArray(targetUid)) {
      const batch = adminDb.batch();

      for (const userUid of targetUid) {
        const ref = adminDb.collection('notifications').doc();

        batch.set(ref, {
          ...baseNotificationData,
          targetUid: userUid,
        });
      }

      await batch.commit();
    } else {
      await adminDb.collection('notifications').add({
        ...baseNotificationData,
        ...(targetUid && { targetUid }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error creando notificación:', error);

    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
