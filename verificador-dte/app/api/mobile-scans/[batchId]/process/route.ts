import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { consultCodFechaViaGo, DEFAULT_CONCURRENCY } from '@/lib/go-dte-api';
import { recordServerProcessingLog } from '@/lib/server-processing-log';
import { summarizeResults } from '@/lib/processing-log';
import {
  buildWorkbook,
  tryParseFechaFlexible,
  isProbableCodGen,
} from '@/lib/dteCommon';
import * as XLSX from 'xlsx-js-style';

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

function pickParam(url: URL, names: string[]) {
  const entries = Array.from(url.searchParams.entries());
  for (const name of names) {
    const direct = url.searchParams.get(name);
    if (direct) return direct;

    const found = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (found?.[1]) return found[1];
  }

  return '';
}

function normalizeDateYmd(value: string) {
  const parsed = tryParseFechaFlexible(value);
  if (!parsed) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function extractUrl(value: string) {
  const cleanValue = value
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/[\s,;]+$/g, '');

  if (cleanValue.startsWith('http://') || cleanValue.startsWith('https://')) {
    return cleanValue;
  }

  const match = cleanValue.match(/https?:\/\/[^\s"']+/i);
  return match?.[0]?.replace(/[\s,;]+$/g, '') || '';
}

function parseScannedUrl(value: string) {
  try {
    const extracted = extractUrl(value);
    if (!extracted) {
      return {
        ok: false as const,
        error: 'El QR no contiene una URL válida.',
      };
    }

    const url = new URL(extracted);
    const codGen =
      pickParam(url, [
        'codGen',
        'codigoGeneracion',
        'codigo',
        'codigoGeneracionDte',
        'codigo_generacion',
        'FeCodigoGeneracion',
      ]);
    const fechaRaw =
      pickParam(url, [
        'fechaEmi',
        'fecEmi',
        'fecha',
        'fechaEmision',
        'fecha_emision',
        'FeFechaGeneracionDte',
        'fechaGeneracionDte',
      ]);

    if (!codGen || !fechaRaw) {
      return {
        ok: false as const,
        error: 'El QR no contiene codGen y fechaEmi.',
      };
    }

    if (!isProbableCodGen(codGen)) {
      return {
        ok: false as const,
        error: 'El QR contiene un código de generación inválido.',
      };
    }

    const fechaYmd = normalizeDateYmd(fechaRaw);
    if (!fechaYmd) {
      return {
        ok: false as const,
        error: 'El QR contiene una fecha de emisión inválida.',
      };
    }

    return {
      ok: true as const,
      codGen: codGen.trim().toUpperCase(),
      fechaYmd,
      rawUrl: extracted,
    };
  } catch {
    return {
      ok: false as const,
      error: 'El contenido escaneado no es una URL válida.',
    };
  }
}

function invalidResult(value: string, error: string) {
  return {
    ok: false,
    url: value,
    linkVisita: value,
    visitar: 'Abrir',
    ambiente: '',
    codGen: '',
    fechaEmi: '',
    estado: 'ERROR',
    descripcionEstado: '',
    tipoDte: '',
    numeroControl: '',
    montoTotal: '',
    error,
  };
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

    const filas = [];
    const invalidos = [];
    const seen = new Set<string>();

    for (const scan of scans) {
      const value = String(scan?.value || '').trim();
      const parsed = parseScannedUrl(value);

      if (!parsed.ok) {
        invalidos.push(invalidResult(value, parsed.error));
        continue;
      }

      const key = `${parsed.codGen}|${parsed.fechaYmd}`;
      if (seen.has(key)) continue;
      seen.add(key);
      filas.push(parsed);
    }

    let consultados: Record<string, unknown>[] = [];
    if (filas.length) {
      const goResp = await consultCodFechaViaGo(
        filas.map((f) => ({ codGen: f.codGen, fechaYmd: f.fechaYmd })),
        { concurrencia: DEFAULT_CONCURRENCY, enrichCreditNotes: false },
      );
      consultados = goResp.resultados;
    }

    const results = [...invalidos, ...consultados];
    const wb = buildWorkbook(results);
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const filename = `escaneos_mobile_${Date.now()}.xlsx`;

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
      excelBase64: Buffer.from(excelBuffer).toString('base64'),
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
