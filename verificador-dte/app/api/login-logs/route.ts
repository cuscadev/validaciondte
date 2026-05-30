import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

    let uid = '';
    let email = String(body.email || '').trim().toLowerCase();
    let role = '';

    if (token) {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
      email = (decoded.email || email).toLowerCase();
      const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
      role = userSnap.data()?.role || '';
    }

    await adminDb.collection('loginLogs').add({
      uid,
      email,
      role,
      success: Boolean(body.success),
      reason: String(body.reason || ''),
      provider: 'password',
      userAgent: String(body.userAgent || ''),
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error guardando log' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireSuperadmin(req);
    const params = req.nextUrl.searchParams;
    const limit = Math.min(Number(params.get('limit') || 200), 500);
    const email = (params.get('email') || '').trim().toLowerCase();
    const outcome = params.get('outcome') || '';
    const from = params.get('from');
    const to = params.get('to');

    let query: FirebaseFirestore.Query = adminDb.collection('loginLogs');
    if (from) query = query.where('createdAt', '>=', new Date(`${from}T00:00:00`));
    if (to) query = query.where('createdAt', '<=', new Date(`${to}T23:59:59.999`));

    const snap = await query.orderBy('createdAt', 'desc').limit(limit).get();
    const serializeDate = (value: any) => value?.toDate?.()?.toISOString?.() || value?.toISOString?.() || null;
    let logs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: serializeDate(doc.data().createdAt) }));

    logs = logs.filter((log: any) => {
      if (email && !String(log.email || '').toLowerCase().includes(email)) return false;
      if (outcome === 'success' && !log.success) return false;
      if (outcome === 'failed' && log.success) return false;
      return true;
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No autorizado' },
      { status: 403 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireSuperadmin(req);
    let deleted = 0;

    while (true) {
      const snap = await adminDb.collection('loginLogs').limit(500).get();
      if (snap.empty) break;

      const batch = adminDb.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deleted += snap.size;

      if (snap.size < 500) break;
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo vaciar la coleccion' },
      { status: 500 }
    );
  }
}
