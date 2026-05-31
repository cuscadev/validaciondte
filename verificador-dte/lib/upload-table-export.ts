import { toPdfExportRow } from '@/lib/dte-result-normalize';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style';

export type PdfExportRow = {
  codigoGeneracion: string;
  selloRecepcion: string;
  montos: string;
  comentario: string;
};

export type PdfExportProfile =
  | 'verificador'
  | 'consultarjson'
  | 'consultasLotes'
  | 'compras'
  | 'ventas'
  | 'sujetosExcluidos'
  | 'liquidacion'
  | 'qrPdf';

const PDF_HEADERS = [
  'Código de generación',
  'Sello de recepción',
  'Montos',
  'Comentario',
] as const;

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'object') {
    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
  }
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function exportDateSuffix(): string {
  return new Date().toISOString().slice(0, 10);
}

const pdfMappers: Record<PdfExportProfile, (row: Record<string, unknown>) => PdfExportRow> = {
  verificador: toPdfExportRow,
  consultarjson: toPdfExportRow,
  consultasLotes: toPdfExportRow,
  compras: toPdfExportRow,
  ventas: toPdfExportRow,
  sujetosExcluidos: toPdfExportRow,
  liquidacion: toPdfExportRow,
  qrPdf: toPdfExportRow,
};

function collectColumns(rows: Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => keys.add(key));
  });
  return Array.from(keys);
}

export function exportRowsToCsv(
  rows: Record<string, unknown>[],
  filename: string,
  columns?: string[]
) {
  if (!rows.length) {
    toast.error('No hay datos para exportar.');
    return;
  }

  const headers = columns?.length ? columns : collectColumns(rows);
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => csvValue(row[header])).join(',')
    ),
  ].join('\n');

  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  });

  downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function exportRowsToExcel(
  rows: Record<string, unknown>[],
  filename: string,
  sheetName = 'Datos'
) {
  if (!rows.length) {
    toast.error('No hay datos para exportar.');
    return;
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(
    workbook,
    filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  );
}

export function exportRowsToPdf(
  rows: Record<string, unknown>[],
  mapRow: (row: Record<string, unknown>) => PdfExportRow,
  filename: string
) {
  if (!rows.length) {
    toast.error('No hay datos para exportar.');
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const body = rows.map((row) => {
    const mapped = mapRow(row);
    return [
      mapped.codigoGeneracion,
      mapped.selloRecepcion,
      mapped.montos || '-',
      mapped.comentario,
    ];
  });

  autoTable(doc, {
    head: [PDF_HEADERS.slice()],
    body,
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: {
      fillColor: [254, 226, 226],
      textColor: [127, 29, 29],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 130 },
      2: { cellWidth: 180 },
      3: { cellWidth: 'auto' },
    },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function exportPdfByProfile(
  rows: Record<string, unknown>[],
  profile: PdfExportProfile,
  filename: string
) {
  exportRowsToPdf(rows, pdfMappers[profile], filename);
}

export function buildExportFilename(base: string, extension: 'csv' | 'pdf' | 'xlsx') {
  return `${base}_${exportDateSuffix()}.${extension}`;
}
