export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import { buildDteExcelBase64 } from '@/lib/dteCommon';
import { getGoDteApiUrl } from '@/lib/go-dte-api';
import { requireAuth } from '@/lib/server-auth';
import { assertMonthlyUsageLimit, assertBatchProcessLimit } from '@/lib/usage-limits';

const URL_REGEX = /https?:\/\/(?:admin\.factura\.gob\.sv|webapp\.dtes\.mh\.gob\.sv)\/consultaPublica\/?\?[^\s,;"'<>]+/gi;

function countLinksFromText(text: string, seen: Set<string>) {
  const matches = text.replace(/&amp;/g, '&').match(URL_REGEX) || [];
  for (const match of matches) {
    seen.add(match.trim().replace(/[,.;&\s]+$/g, ''));
  }
}

async function countLinksFromFile(file: File, seen: Set<string>) {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith('.xlsx') || name.endsWith('.xlsm') || name.endsWith('.xls')) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
        header: 1,
        raw: false,
      });
      for (const row of rows) {
        for (const cell of row) {
          countLinksFromText(String(cell || ''), seen);
        }
      }
    }
    return;
  }

  countLinksFromText(buffer.toString('utf8'), seen);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const form = await req.formData();
    const routeKey = String(form.get('routeKey') || 'verificador');
    const files = [...form.getAll('files'), ...form.getAll('file')].filter(
      (item): item is File => item instanceof File
    );

    const seen = new Set<string>();
    for (const file of files) {
      await countLinksFromFile(file, seen);
    }

    await assertBatchProcessLimit(user, routeKey, seen.size);
    await assertMonthlyUsageLimit(user, routeKey, seen.size);

    const upstreamForm = new FormData();
    for (const file of files) {
      upstreamForm.append('files', file, file.name);
    }

    const upstream = await fetch(`${getGoDteApiUrl()}/api/procesar`, {
      method: 'POST',
      body: upstreamForm,
    });

    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !contentType.includes('application/json')) {
      return new Response(await upstream.arrayBuffer(), {
        status: upstream.status,
        headers: { 'content-type': contentType || 'application/json' },
      });
    }

    const payload = (await upstream.json()) as {
      resultados?: Record<string, unknown>[];
      excelBase64?: string;
      filename?: string;
      [key: string]: unknown;
    };

    if (Array.isArray(payload.resultados) && payload.resultados.length > 0) {
      const excel = buildDteExcelBase64(payload.resultados);
      payload.excelBase64 = excel.excelBase64;
      payload.filename = excel.filename;
    }

    return Response.json(payload, { status: upstream.status });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 403 }
    );
  }
}
