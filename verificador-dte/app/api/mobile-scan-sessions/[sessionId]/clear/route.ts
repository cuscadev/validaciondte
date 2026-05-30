import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(req: NextRequest, context: Params) {
  try {
    const identity = await requireAuth(req);
    const { sessionId } = await context.params;
    const { folderId, all } = await req.json();

    const sessionRef = adminDb.collection('mobileScanSessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
    }

    const session = sessionSnap.data() || {};
    if (session.uid !== identity.uid) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (all) {
      await sessionRef.update({
        folders: [],
        folderCodes: [],
        updatedAt: new Date(),
      });

      return NextResponse.json({ success: true });
    }

    const folders = Array.isArray(session.folders) ? session.folders : [];
    const nextFolders = folders.filter((folder) => folder.id !== folderId);

    await sessionRef.update({
      folders: nextFolders,
      folderCodes: nextFolders.map((folder) => folder.code).filter(Boolean),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/mobile-scan-sessions/clear] Error clearing session', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
