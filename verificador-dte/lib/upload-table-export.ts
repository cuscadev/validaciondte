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

export type PdfExportOptions = {
  title?: string;
  createdBy?: string;
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
  'Codigo generacion',
  'Fecha/hora emision',
  'Tipo DTE',
  'Estado',
  'Sello recepcion',
  'Numero control',
  'Emisor',
  'Receptor',
  'Monto total',
  'Nota credito',
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

function valueText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
}

function firstValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = valueText(row[key]);
    if (value) return value;
  }
  return '';
}

function formatDateTimeForPdf(date = new Date()): string {
  return date.toLocaleString('es-SV', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPdfMonto(row: Record<string, unknown>, mapped: PdfExportRow): string {
  const direct = firstValue(row, [
    'montoTotal',
    'montoTotalOperacion',
    'totalPagarOperacion',
    'totalPagar',
    'TotalPagar',
    'MontoGravado',
    'Compra',
  ]);
  return direct || mapped.montos || '-';
}

function buildPdfBodyRow(row: Record<string, unknown>, mapped: PdfExportRow): string[] {
  const fechaHora = firstValue(row, [
    'fechaHoraGeneracion',
    'fechaHoraProcesamiento',
    'fechaEmi',
    'FecEmi',
    'FechaEmision',
  ]);
  const emisor = firstValue(row, ['emisorNombre', 'NombreEmisor', 'emisorNit', 'Emisor']);
  const receptor = firstValue(row, ['receptorNombre', 'NombreReceptor', 'receptorNit', 'Receptor']);
  const notaCredito = firstValue(row, [
    'notaCreditoCodigoGeneracion',
    'notaCreditoEstado',
    'relacionadosTexto',
  ]);

  return [
    mapped.codigoGeneracion,
    fechaHora || '-',
    firstValue(row, ['tipoDte', 'tipoDteNorm', 'TipoDte', 'tipo']) || '-',
    firstValue(row, ['estado', 'Estado']) || '-',
    mapped.selloRecepcion,
    firstValue(row, ['numeroControl', 'NumeroControl']) || '-',
    emisor || '-',
    receptor || '-',
    formatPdfMonto(row, mapped),
    notaCredito || '-',
    mapped.comentario,
  ];
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
  filename: string,
  options: PdfExportOptions = {}
) {
  if (!rows.length) {
    toast.error('No hay datos para exportar.');
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const generatedAt = formatDateTimeForPdf();
  const title = options.title || 'Reporte de verificacion DTE';
  const createdBy = options.createdBy?.trim() || 'Usuario';
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const body = rows.map((row) => buildPdfBodyRow(row, mapRow(row)));

  autoTable(doc, {
    head: [PDF_HEADERS.slice()],
    body,
    startY: 92,
    margin: { top: 92, right: 24, bottom: 36, left: 24 },
    styles: {
      fontSize: 6.5,
      cellPadding: 3,
      overflow: 'linebreak',
      valign: 'top',
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [11, 35, 63],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 92 },
      1: { cellWidth: 66 },
      2: { cellWidth: 58 },
      3: { cellWidth: 50 },
      4: { cellWidth: 78 },
      5: { cellWidth: 72 },
      6: { cellWidth: 76 },
      7: { cellWidth: 76 },
      8: { cellWidth: 54, halign: 'right' },
      9: { cellWidth: 76 },
      10: { cellWidth: 'auto' },
    },
    didDrawPage: () => {
      const pageNumber = doc.getNumberOfPages();
      doc.setFillColor(11, 35, 63);
      doc.rect(0, 0, pageWidth, 62, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(title, 24, 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Emitido: ${generatedAt}`, 24, 45);
      doc.text(`Creado por: ${createdBy}`, 190, 45);
      doc.text(`Registros: ${rows.length}`, pageWidth - 110, 45);

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text(`Pagina ${pageNumber}`, pageWidth - 70, pageHeight - 18);
      doc.text('Sistema de Verificacion DTE', 24, pageHeight - 18);
    },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function exportPdfByProfile(
  rows: Record<string, unknown>[],
  profile: PdfExportProfile,
  filename: string,
  options?: PdfExportOptions
) {
  exportRowsToPdf(rows, pdfMappers[profile], filename, options);
}

export function buildExportFilename(base: string, extension: 'csv' | 'pdf' | 'xlsx') {
  return `${base}_${exportDateSuffix()}.${extension}`;
}
