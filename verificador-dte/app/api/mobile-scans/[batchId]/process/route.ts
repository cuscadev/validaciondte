import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { consultQrScansViaGo } from '@/lib/consult-qr-scans';
import { buildDteExcelBase64 } from '@/lib/dteCommon';
import { recordServerProcessingLog } from '@/lib/server-processing-log';
import { summarizeResults } from '@/lib/processing-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SCANS = 50;

type Identity = {
  uid: string;
  email: string;
  role: string;
};

type Params = {
  params: Promise<{ batchId: string }>;
};

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

function verifyLegacyToken(token: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    return jwt.verify(token, secret) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getIdentity(req: NextRequest): Promise<Identity | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const user = userSnap.data() || {};

    return {
      uid: decoded.uid,
      email: decoded.email || String(user.email || ''),
      role: String(user.role || ''),
    };
  } catch {
    const decoded = verifyLegacyToken(token);
    if (!decoded?.uid) return null;

    return {
      uid: String(decoded.uid),
      email: String(decoded.email || ''),
      role: String(decoded.role || ''),
    };
  }
}

export async function POST(req: NextRequest, context: Params) {
  let batchRef: FirebaseFirestore.DocumentReference | null = null;
  let activeIdentity: Identity | null = null;
  let processingStarted = false;
  let startedAt = new Date();
  let scanCount = 0;

  try {
    const identity = await getIdentity(req);
    if (!identity) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    activeIdentity = identity;
    await req.json().catch(() => ({}));

    const { batchId } = await context.params;
    batchRef = adminDb.collection('mobileScanBatches').doc(batchId);
    const batchSnap = await batchRef.get();

    if (!batchSnap.exists) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
    }

    const batch = batchSnap.data() || {};
    if (batch.uid !== identity.uid) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const scans = Array.isArray(batch.scans) ? batch.scans.slice(0, MAX_SCANS) : [];
    if (!scans.length) {
      return NextResponse.json({ error: 'El lote no tiene escaneos.' }, { status: 400 });
    }

    await batchRef.update({
      status: 'processing',
      updatedAt: new Date(),
    });
    processingStarted = true;
    startedAt = new Date();
    scanCount = scans.length;

    const scanValues = scans.map((scan: { value?: string }) => String(scan?.value || '').trim());
    const batchResult = await consultQrScansViaGo(scanValues, {
      enrichCreditNotes: true,
    });

    const results = batchResult.resultados;
    const { excelBase64, filename } = buildDteExcelBase64(results);

    await batchRef.update({
      status: 'processed',
      results,
      processedCount: results.length,
      processedAt: new Date(),
      updatedAt: new Date(),
      filename,
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
      console.error('[api/mobile-scans/process] Error saving processing log', logError);
    });

    return NextResponse.json({
      success: true,
      batchId,
      results,
      filename,
      excelBase64,
    });
  } catch (error) {
    console.error('[api/mobile-scans/process] Error processing batch', error);

    if (batchRef) {
      await batchRef.update({
        status: 'error',
        updatedAt: new Date(),
        error: error instanceof Error ? error.message : 'Error interno',
      }).catch(() => {});
    }

    if (processingStarted && activeIdentity) {
      const endedAt = new Date();
      const message = error instanceof Error ? error.message : 'Error interno';
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
        console.error('[api/mobile-scans/process] Error saving error log', logError);
      });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
