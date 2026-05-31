import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-auth';
import { consultCodFechaViaGo, DEFAULT_CONCURRENCY } from '@/lib/go-dte-api';
import {
  buildWorkbook,
  isProbableCodGen,
  tryParseFechaFlexible,
} from '@/lib/dteCommon';
import * as XLSX from 'xlsx-js-style';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ sessionId: string }>;
};

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
  const cleanValue = value.trim().replace(/&amp;/g, '&').replace(/[\s,;]+$/g, '');
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
      return { ok: false as const, error: 'El QR no contiene una URL vÃ¡lida.' };
    }

    const url = new URL(extracted);
    const codGen = pickParam(url, [
      'codGen',
      'codigoGeneracion',
      'codigo',
      'codigoGeneracionDte',
      'codigo_generacion',
      'FeCodigoGeneracion',
    ]);
    const fechaRaw = pickParam(url, [
      'fechaEmi',
      'fecEmi',
      'fecha',
      'fechaEmision',
      'fecha_emision',
      'FeFechaGeneracionDte',
      'fechaGeneracionDte',
    ]);

    if (!codGen || !fechaRaw) {
      return { ok: false as const, error: 'El QR no contiene cÃ³digo y fecha.' };
    }

    if (!isProbableCodGen(codGen)) {
      return { ok: false as const, error: 'CÃ³digo de generaciÃ³n invÃ¡lido.' };
    }

    const fechaYmd = normalizeDateYmd(fechaRaw);
    if (!fechaYmd) {
      return { ok: false as const, error: 'Fecha de emisiÃ³n invÃ¡lida.' };
    }

    return {
      ok: true as const,
      codGen: codGen.trim().toUpperCase(),
      fechaYmd,
    };
  } catch {
    return { ok: false as const, error: 'El contenido escaneado no es una URL vÃ¡lida.' };
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
  let activeSessionRef: FirebaseFirestore.DocumentReference | null = null;
  let activeFolderId = '';
  let processingStarted = false;

  try {
    const identity = await requireAuth(req);
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
    const filename = `escaneos_${folder.name || 'mobile'}_${Date.now()}.xlsx`;

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
      };
    }

    await sessionRef.update({
      folders: freshFolders,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      results,
      filename,
      excelBase64: Buffer.from(excelBuffer).toString('base64'),
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
    const status = message.includes('procesandose') ? 409 : 500;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

