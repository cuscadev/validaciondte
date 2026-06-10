// app/api/verificarcodyfecha/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { put } from '@vercel/blob';
import * as XLSX from 'xlsx-js-style';

import { getGoDteApiUrl } from '@/lib/go-dte-api';
import { requireAuth } from '@/lib/server-auth';
import { assertMonthlyUsageLimit } from '@/lib/usage-limits';

const UUID_REGEX = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
const DATE_REGEX = /^(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})$/;

export async function GET() {
  const rows = [
    ['codGen', 'fecha'],
    ['12345678-1234-1234-1234-123456789ABC', '2026-01-15'],
    ['87654321-4321-4321-4321-CBA987654321', '15/01/2026'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 42 }, { wch: 16 }];
  ws['A1'].s = {
    font: { bold: true, color: { rgb: '111827' } },
    fill: { fgColor: { rgb: 'FACC15' } },
    alignment: { horizontal: 'center' },
  };
  ws['B1'].s = ws['A1'].s;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_verificacion_codigo_fecha.xlsx"',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

export async function POST(req) {
  let user;
  let form;
  try {
    user = await requireAuth(req);
    form = await req.formData();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No autorizado' },
      { status: 401 }
    );
  }

  const routeKey = String(form.get('routeKey') || 'verificarodyfecha');
  const files = [...form.getAll('files'), ...form.getAll('file')].filter((item) => item instanceof File);
  const count = await countCodFechaRows(files);

  try {
    await assertMonthlyUsageLimit(user, routeKey, count);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Limite alcanzado' },
      { status: 403 }
    );
  }

  const upstreamForm = new FormData();
  for (const file of files) {
    upstreamForm.append('files', file, file.name);
  }

  const upstream = await fetch(`${getGoDteApiUrl()}/api/verificarcodyfecha`, {
    method: 'POST',
    body: upstreamForm,
  });
  if (!upstream.ok) {
    return new Response(await upstream.text(), { status: upstream.status });
  }

  const data = await upstream.json();
  const { filename, total, resultados, excelBase64 } = data;
  const payloadBase = { filename, total, resultados };

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token && excelBase64) {
    try {
      const excelBuffer = Buffer.from(excelBase64, 'base64');
      const contentTypeExcel = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const { url } = await put(filename || `verificacion_cod_fecha_${Date.now()}.xlsx`, excelBuffer, {
        access: 'public',
        contentType: contentTypeExcel,
        token,
      });
      return NextResponse.json({ ...payloadBase, downloadUrl: url });
    } catch (error) {
      console.warn(
        'Vercel Blob upload failed for verificarcodyfecha; returning API excelBase64 instead.',
        error
      );
    }
  }

  if (excelBase64) {
    return NextResponse.json({ ...payloadBase, excelBase64 });
  }

  return NextResponse.json(payloadBase);
}

async function countCodFechaRows(files) {
  const seen = new Set();
  for (const file of files) {
    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    if (name.endsWith('.xlsx') || name.endsWith('.xlsm') || name.endsWith('.xls')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
          header: 1,
          raw: false,
        });
        for (const row of rows) {
          addCodFechaRow(row, seen);
        }
      }
      continue;
    }

    for (const line of buffer.toString('utf8').split(/\r?\n/)) {
      addCodFechaRow(line.split(/\t|;|,/), seen);
    }
  }
  return seen.size;
}

function addCodFechaRow(row, seen) {
  const cells = Array.isArray(row) ? row.map((cell) => String(cell || '').trim()) : [];
  if (cells.some((cell) => /cod/i.test(cell)) && cells.some((cell) => /fecha/i.test(cell))) {
    return;
  }

  const cod = cells.find((cell) => UUID_REGEX.test(cell));
  const fecha = cells.find((cell) => DATE_REGEX.test(cell));
  if (cod && fecha) {
    seen.add(`${cod.toUpperCase()}|${fecha}`);
  }
}
