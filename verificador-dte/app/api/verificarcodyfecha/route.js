// app/api/verificarcodyfecha/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { put } from '@vercel/blob';
import * as XLSX from 'xlsx-js-style';

import { proxyMultipartToGo } from '@/lib/go-dte-api';

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
  const body = Buffer.from(await req.arrayBuffer());
  const contentType = req.headers.get('content-type') || 'multipart/form-data';

  const upstream = await proxyMultipartToGo('/api/verificarcodyfecha', body, contentType);
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
