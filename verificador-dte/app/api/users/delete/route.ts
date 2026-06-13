import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/server-auth';
import { deleteAppUserAfterFirestoreDelete } from '@/lib/server-user-sync';

export async function POST(req: NextRequest) {
  try {
    await requireSuperadmin(req);

    const { uid } = await req.json() as { uid?: string };

    if (!uid) {
      return NextResponse.json({ error: 'Falta uid' }, { status: 400 });
    }

    await adminDb.collection('users').doc(uid).delete();
    await deleteAppUserAfterFirestoreDelete(uid);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    if (error instanceof Error && error.message === 'No autorizado') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
