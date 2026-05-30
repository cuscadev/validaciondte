// src/app/api/admin/obligacion/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/server-auth';

type ObligationPayload = {
  id?: string;
  title?: string;
  description?: string;
  dueDate?: string;
  category?: string;
  status?: 'pending' | 'completed' | 'expired';
  targetMode?: 'all' | 'role' | 'selected';
  targetRole?: string | null;
  targetUids?: string[];
  notifyClient?: boolean;
  reminderDaysBefore?: number[];
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

function normalizeReminderDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [1];

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0);
}

export async function GET(req: NextRequest) {
  try {
    await requireSuperadmin(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const mode = searchParams.get('mode');
    const role = searchParams.get('role');

    if (mode === 'users') {
      let usersQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
        adminDb.collection('users');

      if (role && role !== 'all') {
        usersQuery = usersQuery.where('role', '==', role);
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
            displayName:
              data.displayName ||
              data.name ||
              data.nombre ||
              data.email ||
              doc.id,
            role: data.role || '',
          };
        })
        .sort((a, b) => a.email.localeCompare(b.email));

      return NextResponse.json({ users });
    }

    if (id) {
      const docSnap = await adminDb.collection('obligations').doc(id).get();

      if (!docSnap.exists) {
        return NextResponse.json(
          { error: 'Obligación no encontrada' },
          { status: 404 }
        );
      }

      const data = docSnap.data();

      return NextResponse.json({
        obligation: {
          id: docSnap.id,
          ...data,
          dueDate: toDateString(data?.dueDate),
        },
      });
    }

    const obligationsSnap = await adminDb
      .collection('obligations')
      .orderBy('dueDate', 'asc')
      .limit(500)
      .get();

    const obligations = obligationsSnap.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        title: data.title || '',
        description: data.description || '',
        dueDate: toDateString(data.dueDate),
        category: data.category || 'Tributario',
        status: data.status || 'pending',
        targetMode: data.targetMode || 'all',
        targetRole: data.targetRole || null,
        targetUids: data.targetUids || [],
        notifyClient: data.notifyClient ?? true,
        reminderDaysBefore: data.reminderDaysBefore || [1],
        createdAt: data.createdAt || null,
        createdBy: data.createdBy || '',
        updatedAt: data.updatedAt || null,
        updatedBy: data.updatedBy || '',
      };
    });

    return NextResponse.json({ obligations });
  } catch (error: any) {
    console.error('Error obteniendo obligaciones:', error);

    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireSuperadmin(req);

    const body = (await req.json()) as ObligationPayload;

    const {
      title,
      description,
      dueDate,
      category,
      targetMode,
      targetRole,
      targetUids,
      notifyClient,
      reminderDaysBefore,
      status,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: 'El título es requerido' },
        { status: 400 }
      );
    }

    if (!dueDate) {
      return NextResponse.json(
        { error: 'La fecha de vencimiento es requerida' },
        { status: 400 }
      );
    }

    if (!targetMode) {
      return NextResponse.json(
        { error: 'Debe especificar targetMode' },
        { status: 400 }
      );
    }

    if (targetMode === 'role' && !targetRole) {
      return NextResponse.json(
        { error: 'Debe especificar targetRole' },
        { status: 400 }
      );
    }

    if (
      targetMode === 'selected' &&
      (!Array.isArray(targetUids) || targetUids.length === 0)
    ) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos un usuario' },
        { status: 400 }
      );
    }

    const obligationData = {
      title: title.trim(),
      description: description?.trim() || '',
      dueDate: Timestamp.fromDate(new Date(`${dueDate}T00:00:00`)),
      category: category || 'Tributario',
      status: status || 'pending',
      targetMode,
      targetRole: targetMode === 'role' ? targetRole : null,
      targetUids: targetMode === 'selected' ? targetUids || [] : [],
      notifyClient: notifyClient ?? true,
      reminderDaysBefore: normalizeReminderDays(reminderDaysBefore),
      createdAt: Timestamp.now(),
      createdBy: uid,
      updatedAt: Timestamp.now(),
      updatedBy: uid,
    };

    const created = await adminDb.collection('obligations').add(obligationData);

    return NextResponse.json({
      success: true,
      id: created.id,
    });
  } catch (error: any) {
    console.error('Error creando obligación:', error);

    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { uid } = await requireSuperadmin(req);

    const body = (await req.json()) as ObligationPayload;

    const {
      id,
      title,
      description,
      dueDate,
      category,
      targetMode,
      targetRole,
      targetUids,
      notifyClient,
      reminderDaysBefore,
      status,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'El id es requerido' },
        { status: 400 }
      );
    }

    if (!title?.trim()) {
      return NextResponse.json(
        { error: 'El título es requerido' },
        { status: 400 }
      );
    }

    if (!dueDate) {
      return NextResponse.json(
        { error: 'La fecha de vencimiento es requerida' },
        { status: 400 }
      );
    }

    if (!targetMode) {
      return NextResponse.json(
        { error: 'Debe especificar targetMode' },
        { status: 400 }
      );
    }

    if (targetMode === 'role' && !targetRole) {
      return NextResponse.json(
        { error: 'Debe especificar targetRole' },
        { status: 400 }
      );
    }

    if (
      targetMode === 'selected' &&
      (!Array.isArray(targetUids) || targetUids.length === 0)
    ) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos un usuario' },
        { status: 400 }
      );
    }

    const obligationRef = adminDb.collection('obligations').doc(id);
    const obligationSnap = await obligationRef.get();

    if (!obligationSnap.exists) {
      return NextResponse.json(
        { error: 'Obligación no encontrada' },
        { status: 404 }
      );
    }

    await obligationRef.update({
      title: title.trim(),
      description: description?.trim() || '',
      dueDate: Timestamp.fromDate(new Date(`${dueDate}T00:00:00`)),
      category: category || 'Tributario',
      status: status || 'pending',
      targetMode,
      targetRole: targetMode === 'role' ? targetRole : null,
      targetUids: targetMode === 'selected' ? targetUids || [] : [],
      notifyClient: notifyClient ?? true,
      reminderDaysBefore: normalizeReminderDays(reminderDaysBefore),
      updatedAt: Timestamp.now(),
      updatedBy: uid,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error actualizando obligación:', error);

    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireSuperadmin(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'El id es requerido' },
        { status: 400 }
      );
    }

    const obligationRef = adminDb.collection('obligations').doc(id);
    const obligationSnap = await obligationRef.get();

    if (!obligationSnap.exists) {
      return NextResponse.json(
        { error: 'Obligación no encontrada' },
        { status: 404 }
      );
    }

    await obligationRef.delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error eliminando obligación:', error);

    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}