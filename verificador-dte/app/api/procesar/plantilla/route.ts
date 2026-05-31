export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: '065F46' } },
  fill: { fgColor: { rgb: 'D1FAE5' } },
  alignment: { horizontal: 'center' as const },
};

export async function GET() {
  const rows = [
    ['enlace'],
    [
      'https://admin.factura.gob.sv/consultaPublica?ambiente=01&codGen=12345678-1234-1234-1234-123456789ABC&fechaEmi=2026-01-15',
    ],
    [
      'https://admin.factura.gob.sv/consultaPublica?ambiente=01&codGen=87654321-4321-4321-4321-CBA987654321&fechaEmi=15/01/2026',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 100 }];
  ws['A1'].s = HEADER_STYLE;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="plantilla_verificacion_enlaces.xlsx"',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
