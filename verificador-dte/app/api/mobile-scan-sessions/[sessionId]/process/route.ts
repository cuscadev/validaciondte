import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-auth';
import { consultQrScansViaGo } from '@/lib/consult-qr-scans';
import { recordServerProcessingLog } from '@/lib/server-processing-log';
import { summarizeResults } from '@/lib/processing-log';
import { resolveEffectiveUsageLimit } from '@/lib/usage-limits';
import { buildDteExcelBase64 } from '@/lib/dteCommon';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(req: NextRequest, context: Params) {
  let activeSessionRef: FirebaseFirestore.DocumentReference | null = null;
  let activeFolderId = '';
  let processingStarted = false;
  let activeIdentity: Awaited<ReturnType<typeof requireAuth>> | null = null;
  let startedAt = new Date();
  let scanCount = 0;

  try {
    const identity = await requireAuth(req);
    activeIdentity = identity;
    const { sessionId } = await context.params;
    const { folderId } = await req.json();
    activeFolderId = folderId;

    const sessionRef = adminDb.collection('mobileScanSessions').doc(sessionId);
    activeSessionRef = sessionRef;
    const { folder, scans } = await adminDb.runTransaction(async (tx) => {
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) {
        throw new Error('Sesion no encontrada');
      }

      const session = sessionSnap.data() || {};
      if (session.uid !== identity.uid) {
        throw new Error('No autorizado');
      }

      const folders = Array.isArray(session.folders) ? [...session.folders] : [];
      if (folders.some((item) => item.status === 'processing')) {
        throw new Error('Ya hay una carpeta procesandose. Espera a que finalice para iniciar otra.');
      }

      const folderIndex = folders.findIndex((item) => item.id === folderId);
      if (folderIndex < 0) {
        throw new Error('Carpeta no encontrada');
      }

      const folder = folders[folderIndex];
      const scans = Array.isArray(folder.scans) ? folder.scans : [];
      if (!scans.length) {
        throw new Error('La carpeta no tiene escaneos.');
      }

      folders[folderIndex] = { ...folder, status: 'processing', updatedAt: new Date().toISOString() };
      tx.update(sessionRef, { folders, updatedAt: new Date() });

      return { folder, scans };
    });
    processingStarted = true;
    startedAt = new Date();
    scanCount = scans.length;

    const folderLimit = await resolveEffectiveUsageLimit(identity, 'escaneos-mobile');
    if (folderLimit !== null && scans.length > folderLimit) {
      throw new Error(`Esta carpeta tiene ${scans.length} links y tu limite actual es ${folderLimit}. Ajusta el limite en planes, organizacion o usuario antes de procesarla.`);
    }

    const scanValues = scans.map((scan: { value?: string }) => String(scan?.value || '').trim());
    const batchResult = await consultQrScansViaGo(scanValues, {
      enrichCreditNotes: true,
    });

    const results = batchResult.resultados;
    const { excelBase64 } = buildDteExcelBase64(results);
    const exportFilename = `escaneos_${folder.name || 'mobile'}_${Date.now()}.xlsx`;

    const freshSnap = await sessionRef.get();
    const fresh = freshSnap.data() || {};
    const freshFolders = Array.isArray(fresh.folders) ? [...fresh.folders] : [];
    const freshIndex = freshFolders.findIndex((item: { id?: string }) => item.id === folderId);
    if (freshIndex >= 0) {
      freshFolders[freshIndex] = {
        ...freshFolders[freshIndex],
        status: 'processed',
        results,
        processedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        filename: exportFilename,
      };
    }

    await sessionRef.update({
      folders: freshFolders,
      updatedAt: new Date(),
    });

    const endedAt = new Date();
    await recordServerProcessingLog(req, identity, {
      routeKey: 'escaneos-mobile',
      moduleName: 'Escaneos Mobile',
      source: 'mobile-scans',
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: endedAt.getTime() - startedAt.getTime(),
      files: {
        count: 0,
        totalBytes: 0,
        extensions: [],
        mimeTypes: [],
      },
      ...summarizeResults(results as Array<{ estado?: string; error?: string }>),
    }).catch((logError) => {
      console.error('[api/mobile-scan-sessions/process] Error saving processing log', logError);
    });

    return NextResponse.json({
      success: true,
      results,
      filename: exportFilename,
      excelBase64,
    });
  } catch (error) {
    console.error('[api/mobile-scan-sessions/process] Error processing folder', error);
    if (processingStarted && activeSessionRef && activeFolderId) {
      const snap = await activeSessionRef.get();
      const session = snap.data() || {};
      const folders = Array.isArray(session.folders) ? [...session.folders] : [];
      const folderIndex = folders.findIndex((item: { id?: string }) => item.id === activeFolderId);
      if (folderIndex >= 0) {
        folders[folderIndex] = {
          ...folders[folderIndex],
          status: 'error',
          updatedAt: new Date().toISOString(),
        };
        await activeSessionRef.update({ folders, updatedAt: new Date() });
      }
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    if (processingStarted && activeIdentity) {
      const endedAt = new Date();
      await recordServerProcessingLog(req, activeIdentity, {
        routeKey: 'escaneos-mobile',
        moduleName: 'Escaneos Mobile',
        source: 'mobile-scans',
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        files: {
          count: 0,
          totalBytes: 0,
          extensions: [],
          mimeTypes: [],
        },
        totalRecords: scanCount,
        successCount: 0,
        errorCount: scanCount || 1,
        statusBreakdown: { ERROR: scanCount || 1 },
        outcome: 'error',
        errorMessage: message,
      }).catch((logError) => {
        console.error('[api/mobile-scan-sessions/process] Error saving error log', logError);
      });
    }

    const status = message.includes('procesandose') ? 409 : 500;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
