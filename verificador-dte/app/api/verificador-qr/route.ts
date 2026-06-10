import { NextRequest, NextResponse } from 'next/server';
import { consultCodFechaViaGo, DEFAULT_CONCURRENCY } from '@/lib/go-dte-api';
import {
  buildInvalidQrResult,
  parseConsultaPublicaUrl,
} from '@/lib/hacienda-consulta-url';
import { requireAuth } from '@/lib/server-auth';
import { assertMonthlyUsageLimit } from '@/lib/usage-limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ParsedScanItem = {
  codGen: string;
  fechaYmd: string;
  ambiente: string;
  raw: string;
};

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

    const invalidResults: Record<string, unknown>[] = [];
    const validItems: ParsedScanItem[] = [];
    const seen = new Set<string>();

    for (const raw of scans) {
      const parsed = parseConsultaPublicaUrl(raw, fallbackAmbiente);
      if (!parsed.ok) {
        invalidResults.push(buildInvalidQrResult(raw, parsed.error));
        continue;
      }

      const key = `${parsed.codGen}|${parsed.fechaYmd}|${parsed.ambiente}`;
      if (seen.has(key)) continue;
      seen.add(key);

      validItems.push({
        codGen: parsed.codGen,
        fechaYmd: parsed.fechaYmd,
        ambiente: parsed.ambiente,
        raw,
      });
    }

    await assertMonthlyUsageLimit(user, routeKey, validItems.length);

    const groups = new Map<string, ParsedScanItem[]>();
    for (const item of validItems) {
      const list = groups.get(item.ambiente) ?? [];
      list.push(item);
      groups.set(item.ambiente, list);
    }

    const consultados: Record<string, unknown>[] = [];
    let filename: string | undefined;
    let excelBase64: string | undefined;
    let jobId: string | undefined;
    let status: string | undefined;
    let total = 0;
    let done = 0;

    const groupEntries = Array.from(groups.entries());
    const singleGroup = groupEntries.length === 1;

    for (const [ambiente, items] of groupEntries) {
      const goResp = await consultCodFechaViaGo(
        items.map((item) => ({ codGen: item.codGen, fechaYmd: item.fechaYmd })),
        {
          ambiente,
          concurrencia,
          includeExcel: includeExcel && singleGroup,
          enrichCreditNotes: true,
          async: asyncMode && singleGroup && items.length > 10,
        }
      );

      consultados.push(...goResp.resultados);
      total += goResp.total ?? items.length;
      done += goResp.done ?? items.length;
      filename = goResp.filename ?? filename;
      excelBase64 = goResp.excelBase64 ?? excelBase64;
      jobId = goResp.jobId ?? jobId;
      status = goResp.status ?? status;
    }

    const resultados = [...invalidResults, ...consultados];

    return NextResponse.json({
      routeKey,
      total: resultados.length,
      done,
      jobId,
      status,
      filename,
      excelBase64,
      resultados,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 403 }
    );
  }
}
