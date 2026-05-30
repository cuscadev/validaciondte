import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ sessionId: string }>;
};

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function makeUniqueFolderCode() {
  for (let i = 0; i < 10; i++) {
    const code = makeCode();
    const snap = await adminDb
      .collection('mobileScanSessions')
      .where('folderCodes', 'array-contains', code)
      .limit(1)
      .get();

    if (snap.empty) return code;
  }

  return makeCode();
}

function cleanName(value: unknown) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  return name.slice(0, 60) || `Carpeta ${new Date().toLocaleString('es-SV')}`;
}

export async function POST(req: NextRequest, context: Params) {
  try {
    const identity = await requireAuth(req);
    const { sessionId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const name = cleanName(body?.name);

    const sessionRef = adminDb.collection('mobileScanSessions').doc(sessionId);
    const code = await makeUniqueFolderCode();

    const folder = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) throw new Error('Sesión no encontrada');

      const session = snap.data() || {};
      if (session.uid !== identity.uid) throw new Error('No autorizado');

      const folders = Array.isArray(session.folders) ? [...session.folders] : [];

      const nextFolder = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        code,
        name,
        scans: [],
        results: [],
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      folders.push(nextFolder);

      tx.update(sessionRef, {
        folders,
        folderCodes: folders.map((item) => item.code).filter(Boolean),
        updatedAt: new Date(),
      });

      return nextFolder;
    });

    return NextResponse.json({ folder });
  } catch (error) {
    console.error('[api/mobile-scan-sessions/folders] Error creating folder', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
