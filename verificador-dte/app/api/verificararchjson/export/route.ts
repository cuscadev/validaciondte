export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import * as XLSX from 'xlsx-js-style';
import { put } from '@vercel/blob';
import { buildWorkbook } from '@/lib/dteCommon';

type ExportBody = {
  resultados?: Record<string, unknown>[];
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ExportBody;
    const resultados = Array.isArray(body.resultados) ? body.resultados : [];

    if (resultados.length === 0) {
      return NextResponse.json({ error: 'No hay resultados para exportar.' }, { status: 400 });
    }

    const wb = buildWorkbook(resultados, { includeColumnSums: true });
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const filename = `verificacion_json_${Date.now()}.xlsx`;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (token) {
      try {
        const { url } = await put(filename, excelBuffer, {
          access: 'public',
          contentType,
          token,
        });
        return NextResponse.json({ filename, downloadUrl: url });
      } catch (error) {
        console.warn(
          'Vercel Blob upload failed for verificararchjson export; returning base64 instead.',
          error
        );
      }
    }

    const excelBase64 = Buffer.from(excelBuffer).toString('base64');
    return NextResponse.json({ filename, excelBase64 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo generar el Excel.' },
      { status: 500 }
    );
  }
}
