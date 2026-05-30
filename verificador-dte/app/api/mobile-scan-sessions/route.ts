import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function makeUniqueCode() {
  for (let i = 0; i < 8; i++) {
    const code = makeCode();
    const snap = await adminDb
      .collection('mobileScanSessions')
      .where('code', '==', code)
      .limit(1)
      .get();

    const activeExists = snap.docs.some((doc) => doc.data()?.active);
    if (!activeExists) return code;
  }

  return makeCode();
}

export async function POST(req: NextRequest) {
  try {
    const identity = await requireAuth(req);
    const now = new Date();

    const existingSnap = await adminDb
      .collection('mobileScanSessions')
      .where('uid', '==', identity.uid)
      .get();

    const existing = existingSnap.docs
      .map((doc): Record<string, any> & { id: string } => ({
        ...(doc.data() as Record<string, any>),
        id: doc.id,
      }))
      .filter((session) => session.active)
      .sort((a, b) => {
        const aMs = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const bMs = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return bMs - aMs;
      })[0];

    if (existing) {
      return NextResponse.json({
        session: {
          id: existing.id,
          code: existing.code,
          folders: Array.isArray(existing.folders) ? existing.folders : [],
          createdAt: existing.createdAt?.toDate?.().toISOString?.() || '',
          updatedAt: existing.updatedAt?.toDate?.().toISOString?.() || '',
        },
      });
    }

    const code = await makeUniqueCode();

    const ref = await adminDb.collection('mobileScanSessions').add({
      uid: identity.uid,
      email: identity.email,
      role: identity.role,
      code,
      active: true,
      folders: [],
      folderCodes: [],
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      session: {
        id: ref.id,
        code,
        folders: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('[api/mobile-scan-sessions] Error creating session', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
