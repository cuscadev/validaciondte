import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import { requireAuth } from '@/lib/server-auth';
import { assertMonthlyUsageLimit, assertBatchProcessLimit, getMonthlyRouteUsage, resolveEffectiveRenewalConfig, resolveEffectiveUsageLimit, resolveEffectiveBatchLimit } from '@/lib/usage-limits';

const URL_REGEX = /https?:\/\/(?:admin\.factura\.gob\.sv|webapp\.dtes\.mh\.gob\.sv)\/consultaPublica\/?\?[^\s,;"'<>]+/gi;
const UUID_REGEX = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
const DATE_REGEX = /^(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})$/;

function countLinksFromText(text: string, seen: Set<string>) {
  const matches = text.replace(/&amp;/g, '&').match(URL_REGEX) || [];
  for (const match of matches) {
    seen.add(match.trim().replace(/[,.;&\s]+$/g, ''));
  }
}

function addCodFechaRow(row: unknown[], seen: Set<string>) {
  const cells = row.map((cell) => String(cell || '').trim());
  if (cells.some((cell) => /cod/i.test(cell)) && cells.some((cell) => /fecha/i.test(cell))) {
    return;
  }

  const cod = cells.find((cell) => UUID_REGEX.test(cell));
  const fecha = cells.find((cell) => DATE_REGEX.test(cell));
  if (cod && fecha) {
    seen.add(`${cod.toUpperCase()}|${fecha}`);
  }
}

async function countFile(file: File, mode: string, seen: Set<string>) {
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
        if (mode === 'cod-fecha') addCodFechaRow(row, seen);
        else for (const cell of row) countLinksFromText(String(cell || ''), seen);
      }
    }
    return;
  }

  const text = buffer.toString('utf8');
  if (mode === 'cod-fecha') {
    for (const line of text.split(/\r?\n/)) {
      addCodFechaRow(line.split(/\t|;|,/), seen);
    }
    return;
  }

  countLinksFromText(text, seen);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const form = await req.formData();
    const routeKey = String(form.get('routeKey') || '').trim();
    const mode = String(form.get('mode') || 'links');
    if (!routeKey) {
      return NextResponse.json({ error: 'routeKey requerido' }, { status: 400 });
    }

    const files = [...form.getAll('files'), ...form.getAll('file')].filter(
      (item): item is File => item instanceof File
    );
    const seen = new Set<string>();
    for (const file of files) {
      await countFile(file, mode, seen);
    }

    const incomingRecords = seen.size;
    const limit = await resolveEffectiveUsageLimit(user, routeKey);
    const batchLimit = await resolveEffectiveBatchLimit(user, routeKey);
    const renewal = await resolveEffectiveRenewalConfig(user);
    const used = limit === null
      ? 0
      : await getMonthlyRouteUsage(
          user.uid,
          routeKey,
          new Date(),
          renewal.resetDayOfMonth,
          renewal.automaticReset,
          renewal.renewalDate
        );
    await assertBatchProcessLimit(user, routeKey, incomingRecords);
    await assertMonthlyUsageLimit(user, routeKey, incomingRecords);

    return NextResponse.json({
      allowed: true,
      limit,
      batchLimit,
      used,
      incomingRecords,
      ...renewal,
      remaining: limit === null ? null : Math.max(0, limit - used - incomingRecords),
    });
  } catch (error) {
    return NextResponse.json(
      {
        allowed: false,
        error: error instanceof Error ? error.message : 'Limite alcanzado',
      },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 403 }
    );
  }
}
