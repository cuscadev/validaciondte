import { NextRequest, NextResponse } from 'next/server';
import { buildDteExcelBase64 } from '@/lib/dteCommon';
import { consultQrScansViaGo } from '@/lib/consult-qr-scans';
import { DEFAULT_CONCURRENCY } from '@/lib/go-dte-api';
import { parseQrScanBatch } from '@/lib/hacienda-consulta-url';
import { requireAuth } from '@/lib/server-auth';
import { assertMonthlyUsageLimit } from '@/lib/usage-limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const payload = await req.json();
    const scans = Array.isArray(payload?.scans)
      ? payload.scans.map((scan: unknown) => String(scan || '').trim()).filter(Boolean)
      : [];
    const routeKey = String(payload?.routeKey || 'verificador_qr');
    const fallbackAmbiente = String(payload?.ambiente || '01').trim() || '01';
    const concurrencia = Number(payload?.concurrencia || DEFAULT_CONCURRENCY);
    const includeExcel = payload?.includeExcel !== false;
    const asyncMode = payload?.async === true;

    if (!scans.length) {
      return NextResponse.json({ error: 'No hay escaneos para verificar.' }, { status: 400 });
    }

    const { valid, invalid } = parseQrScanBatch(scans, fallbackAmbiente);

    await assertMonthlyUsageLimit(user, routeKey, valid.length);

    const ambienteGroups = new Set(valid.map((item) => item.ambiente));
    const singleAmbienteGroup = ambienteGroups.size <= 1;

    const batch = await consultQrScansViaGo(scans, {
      fallbackAmbiente,
      concurrencia,
      enrichCreditNotes: true,
      async: asyncMode && singleAmbienteGroup && valid.length > 10,
    });

    const resultados = batch.resultados;
    let filename: string | undefined;
    let excelBase64: string | undefined;

    if (includeExcel && resultados.length > 0) {
      const excel = buildDteExcelBase64(resultados);
      filename = `verificacion_qr_${Date.now()}.xlsx`;
      excelBase64 = excel.excelBase64;
    }

    return NextResponse.json({
      routeKey,
      total: resultados.length,
      done: batch.done || resultados.length,
      jobId: batch.jobId,
      status: batch.status,
      filename,
      excelBase64,
      resultados,
      invalidCount: invalid.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 403 }
    );
  }
}
