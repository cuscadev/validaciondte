import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getRouteLabel } from '@/lib/plan-routes';
import { requireAuth } from '@/lib/server-auth';
import { resolveLimitNoticeStatus } from '@/lib/usage-limits';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const routeKey = String(body?.routeKey || '').trim();

    if (!routeKey) {
      return NextResponse.json({ error: 'routeKey requerido' }, { status: 400 });
    }

    const status = await resolveLimitNoticeStatus(user, routeKey, getRouteLabel);
    if (!status.requiresAcknowledgment && status.batchLimit === null) {
      return NextResponse.json({ success: true, alreadyAcknowledged: true });
    }

    const acknowledgedAt = new Date().toISOString();
    await adminDb.collection('users').doc(user.uid).update({
      [`limitNotices.${routeKey}`]: {
        fingerprint: status.fingerprint,
        acknowledgedAt,
      },
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      routeKey,
      fingerprint: status.fingerprint,
      acknowledgedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 500 }
    );
  }
}
