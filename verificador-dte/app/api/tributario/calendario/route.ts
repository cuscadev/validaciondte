import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-auth';

type UserIdentity = {
  role: string;
  candidates: string[];
};

function toDateString(value: any): string {
  if (!value) return '';

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  if (value?.toDate) {
    return value.toDate().toISOString().slice(0, 10);
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return '';
}

async function getUserIdentity(uid: string): Promise<UserIdentity> {
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

function canSeeObligation(params: {
  obligation: any;
  uid: string;
  role: string;
  identity: UserIdentity;
}) {
  const { obligation, role, identity } = params;

  if (role === 'superadmin') return true;

  if (obligation.targetMode === 'all') return true;

  if (
    obligation.targetMode === 'role' &&
    obligation.targetRole &&
    obligation.targetRole === role
  ) {
    return true;
  }

  if (
    obligation.targetMode === 'selected' &&
    Array.isArray(obligation.targetUids) &&
    obligation.targetUids.some((targetUid: string) =>
      identity.candidates.includes(targetUid)
    )
  ) {
    return true;
  }

  if (
    obligation.targetUid &&
    identity.candidates.includes(obligation.targetUid)
  ) {
    return true;
  }

  if (
    obligation.targetRole &&
    (obligation.targetRole === role || obligation.targetRole === 'all')
  ) {
    return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  try {
    const { uid, role } = await requireAuth(req);

    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    const identity = await getUserIdentity(uid);
    const effectiveRole = role || identity.role;

    const obligationsSnap = await adminDb
      .collection('obligations')
      .orderBy('dueDate', 'asc')
      .limit(500)
      .get();

    const obligations = obligationsSnap.docs
      .map((doc) => {
        const data = doc.data();
        const date = toDateString(data.dueDate);

        return {
          id: doc.id,
          title: data.title || 'Sin título',
          date,
          description: data.description || '',
          category: data.category || 'Tributario',
          status: data.status || 'pending',
          notifyClient: data.notifyClient ?? true,
          reminderDaysBefore: data.reminderDaysBefore || [],
          targetMode: data.targetMode || '',
          targetRole: data.targetRole || '',
          targetUids: data.targetUids || [],
          createdAt: data.createdAt || null,
          createdBy: data.createdBy || '',
        };
      })
      .filter((item) => {
        if (!item.date) return false;

        if (start && item.date < start.slice(0, 10)) return false;
        if (end && item.date > end.slice(0, 10)) return false;

        return canSeeObligation({
          obligation: item,
          uid,
          role: effectiveRole,
          identity,
        });
      });

    const events = obligations.map((item) => ({
      id: item.id,
      title: item.title,
      date: item.date,
      extendedProps: {
        description: item.description,
        category: item.category,
        status: item.status,
        notifyClient: item.notifyClient,
        reminderDaysBefore: item.reminderDaysBefore,
        targetMode: item.targetMode,
        targetRole: item.targetRole,
        targetUids: item.targetUids,
        createdBy: item.createdBy,
      },
    }));

    return NextResponse.json({
      obligations,
      events,
    });
  } catch (error: any) {
    console.error('Error cargando calendario tributario:', error);

    return NextResponse.json(
      {
        error: error.message || 'No se pudo cargar el calendario tributario.',
      },
      {
        status: 500,
      }
    );
  }
}