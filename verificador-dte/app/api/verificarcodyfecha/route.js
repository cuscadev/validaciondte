// app/api/verificarcodyfecha/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { put } from '@vercel/blob';
import * as XLSX from 'xlsx-js-style'; 

import {
  launchBrowser, optimizarPagina, procesarFilasConPool,
  parseCSV_codFecha, parseXLSX_codFecha, buildWorkbook
} from '@/lib/dteCommon';

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
  const formData = await req.formData();
  const archivos = formData.getAll('files');
  const unico = formData.get('file');
  if ((!archivos || archivos.length===0) && !unico)
    return new Response('No se proporcionaron archivos.', { status: 400 });
  if (unico) archivos.push(unico);

  // 1) Leer XLSX/CSV y construir [{codGen, fechaYmd}]
  const filas = [];
  for (const f of archivos) {
    const buf = Buffer.from(await f.arrayBuffer());
    const name = (f.name||'').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      parseXLSX_codFecha(buf).forEach(x => filas.push(x));
    } else {
      parseCSV_codFecha(buf.toString('utf8')).forEach(x => filas.push(x));
    }
  }
  if (!filas.length)
    return new Response(
      'No se encontraron filas válidas. Se espera CSV/XLSX con columnas: codGen,fecha (yyyy-MM-dd o dd/MM/yyyy).',
      { status: 400 }
    );

  // 2) Playwright
  let browser = null, resultados = [];
  try {
    browser = await launchBrowser();
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) VerificadorDTE/1.0 Chrome Safari',
    });
    // (opcional) precalentar 1 página
    const p = await ctx.newPage(); await optimizarPagina(p); await p.close();

    resultados = await procesarFilasConPool(ctx, filas, 2);
    await ctx.close();
  } finally {
    if (browser) await browser.close();
  }

  // 3) Excel
  const wb = buildWorkbook(resultados);
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  const filename = `verificacion_cod_fecha_${Date.now()}.xlsx`;
  const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const payloadBase = { filename, total: resultados.length, resultados };

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const { url } = await put(filename, excelBuffer, { access:'public', contentType, token });
    return NextResponse.json({ ...payloadBase, downloadUrl: url });
  }
  const excelBase64 = Buffer.from(excelBuffer).toString('base64');
  return NextResponse.json({ ...payloadBase, excelBase64 });
}
