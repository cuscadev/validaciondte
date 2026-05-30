import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/server-auth';

export async function GET() {
  try {
    const snap = await adminDb.doc('config/plans').get();
    if (!snap.exists) {
      return NextResponse.json({});
    }
    return NextResponse.json(snap.data());
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSuperadmin(req);

    const body = await req.json() as {
      planId?: string;
      plan?: Record<string, unknown>;
    };

    if (!body.planId || !body.plan) {
      return NextResponse.json({ error: 'planId y plan requeridos' }, { status: 400 });
    }

    await adminDb.doc('config/plans').set(
      { [body.planId]: body.plan },
      { merge: true },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No autorizado';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
