import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/server-auth';
import { sanitizeUsageLimits } from '@/lib/usage-limits';

interface SaveUserBody {
  uid: string;
  email: string;
  role: 'superadmin' | 'cliente' | 'colaborador';
  membership: {
    type: 'free' | 'premium' | 'pro';
    expiresAt: string;
  };
  limits?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    await requireSuperadmin(req);

    const body = await req.json() as Partial<SaveUserBody>;
    const { uid, email, role, membership } = body;

    if (!uid || !email || !role || !membership?.type) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      uid,
      email,
      role,
      membership: {
        type: membership.type,
        expiresAt: membership.expiresAt ?? '',
      },
    };

    if ('limits' in body) {
      payload.limits = sanitizeUsageLimits(body.limits);
    }

    await adminDb.collection('users').doc(uid).set(payload, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error guardando usuario:', error);
    if (error instanceof Error && error.message === 'No autorizado') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
