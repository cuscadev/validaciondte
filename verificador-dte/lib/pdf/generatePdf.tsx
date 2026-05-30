import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
  DteJson,
  PdfTemplate,
  tipoDteLabels,
} from '@/types/pdf-template';

export const getString = (value: unknown, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

export const getNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const money = (value: unknown) =>
  getNumber(value).toLocaleString('es-SV', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });

export const sanitizeFileName = (value: string) =>
  value
    .replace(/\.json$/i, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 80);

export const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el logo.'));
    reader.readAsDataURL(file);
  });

export const imageUrlToDataUrl = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo cargar el logo del perfil.');
  const blob = await res.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo preparar el logo.'));
    reader.readAsDataURL(blob);
  });
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const u16 = (value: number) => {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
};

const u32 = (value: number) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
};

const concatBytes = (parts: Uint8Array[]) => {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;

  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
};

export const createZip = async (files: Array<{ name: string; blob: Blob }>) => {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const content = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(content);

    const local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(content.length),
      u32(content.length),
      u16(name.length),
      u16(0),
      name,
      content,
    ]);

    locals.push(local);

    centrals.push(
      concatBytes([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(content.length),
        u32(content.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ])
    );

    offset += local.length;
  }

  const central = concatBytes(centrals);
  const local = concatBytes(locals);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(local.length),
    u16(0),
  ]);

  return new Blob([local, central, end], { type: 'application/zip' });
};

const buildHaciendaUrl = (dte: DteJson) => {
  const identificacion = dte.identificacion || {};
  const codigoGeneracion = getString(identificacion.codigoGeneracion);
  const fechaEmi = getString(identificacion.fecEmi);
  const ambiente = getString(identificacion.ambiente, '01');

  if (!codigoGeneracion || !fechaEmi) return '';

  const params = new URLSearchParams({
    ambiente,
    codGen: codigoGeneracion,
    fechaEmi,
  });

  return `https://admin.factura.gob.sv/consultaPublica?${params.toString()}`;
};

const getSello = (dte: DteJson) =>
  getString(
    dte.selloRecibido ||
      dte.selloRecepcion ||
      dte.respuestaHacienda?.selloRecibido ||
      dte.respuestaHacienda?.selloRecepcion ||
      dte.responseHacienda?.selloRecibido ||
      dte.responseHacienda?.selloRecepcion
  );

const drawLabelValue = (
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text(doc.splitTextToSize(value || '-', width), x, y + 13);
};

const addFooter = (doc: jsPDF, template: PdfTemplate) => {
  const pageCount = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(template.accent);
    doc.line(40, height - 34, width - 40, height - 34);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `PDF generado localmente en el navegador - página ${i} de ${pageCount}`,
      40,
      height - 18
    );
  }
};

export const generateDtePdf = ({
  dte,
  template,
  logoDataUrl,
}: {
  dte: DteJson;
  template: PdfTemplate;
  logoDataUrl: string;
}) => {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const identificacion = dte.identificacion || {};
  const emisor = dte.emisor || {};
  const receptor = dte.receptor || {};
  const resumen = dte.resumen || {};
  const cuerpo = Array.isArray(dte.cuerpoDocumento) ? dte.cuerpoDocumento : [];
  const width = doc.internal.pageSize.getWidth();

  const tipoDte = getString(identificacion.tipoDte);
  const tipoLabel = tipoDteLabels[tipoDte] || `DTE ${tipoDte || '-'}`;
  const codigoGeneracion = getString(identificacion.codigoGeneracion);
  const numeroControl = getString(identificacion.numeroControl);
  const sello = getSello(dte);
  const link = buildHaciendaUrl(dte);

  doc.setFillColor(template.dark);
  doc.rect(0, 0, width, 118, 'F');
  doc.setFillColor(template.accent);
  doc.rect(0, 0, width, 6, 'F');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 42, 26, 64, 64, undefined, 'FAST');
    } catch {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(42, 26, 64, 64, 6, 6, 'F');
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(template.id === 'minimalista' ? 18 : 22);
  doc.text(tipoLabel, logoDataUrl ? 124 : 42, 48);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Generado: ${getString(identificacion.fecEmi)} ${getString(identificacion.horEmi)}`,
    logoDataUrl ? 124 : 42,
    68
  );
  doc.text(`Número de control: ${numeroControl || '-'}`, logoDataUrl ? 124 : 42, 86);

  doc.setFillColor(template.soft);
  doc.roundedRect(40, 138, width - 80, 92, 8, 8, 'F');
  drawLabelValue(doc, 'Código de generación', codigoGeneracion, 58, 160, 230);
  drawLabelValue(doc, 'Sello recibido', sello, 310, 160, 230);
  drawLabelValue(doc, 'Ambiente', getString(identificacion.ambiente, '01'), 58, 202, 120);
  drawLabelValue(
    doc,
    'Modelo / operación',
    `${getString(identificacion.modelo)} / ${getString(identificacion.tipoOperacion)}`,
    190,
    202,
    160
  );
  drawLabelValue(doc, 'Moneda', getString(resumen.codigoMoneda, 'USD'), 370, 202, 80);

  autoTable(doc, {
    startY: 252,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 252 },
      1: { cellWidth: 252 },
    },
    body: [
      [
        {
          content: `EMISOR\n${getString(emisor.nombre)}\nNIT: ${getString(emisor.nit)}\nNRC: ${getString(emisor.nrc)}`,
          styles: { fillColor: [248, 250, 252], textColor: [17, 24, 39] },
        },
        {
          content: `RECEPTOR\n${getString(receptor.nombre)}\nNIT/DUI: ${getString(receptor.nit || receptor.numDocumento)}\nNRC: ${getString(receptor.nrc)}`,
          styles: { fillColor: [248, 250, 252], textColor: [17, 24, 39] },
        },
      ],
    ],
  });

  const itemsY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 360;

  autoTable(doc, {
    startY: itemsY + 22,
    head: [['Cant.', 'Descripción', 'Precio', 'Descuento', 'Total']],
    body: cuerpo.map((item) => [
      getString(item.cantidad || item.cantidadItem || '1'),
      getString(item.descripcion || item.desc || item.nombre || 'Item'),
      money(item.precioUni || item.precioUnitario || 0),
      money(item.montoDescu || item.descuento || 0),
      money(item.ventaGravada || item.ventaExenta || item.ventaNoSuj || item.montoItem || 0),
    ]),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: {
      fillColor: template.dark,
      textColor: '#ffffff',
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 44, halign: 'right' },
      1: { cellWidth: 250 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  const totalsY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 560;
  const boxY = Math.min(totalsY + 24, 646);

  doc.setFillColor(template.soft);
  doc.roundedRect(width - 252, boxY, 212, 98, 8, 8, 'F');

  const totalRows = [
    ['Subtotal', money(resumen.subTotalVentas || resumen.subTotal || 0)],
    ['IVA / tributos', money(resumen.totalIva || resumen.ivaRete1 || resumen.tributos || 0)],
    ['Descuentos', money(resumen.totalDescu || 0)],
    ['Total a pagar', money(resumen.totalPagar || resumen.montoTotalOperacion || resumen.totalGravada || 0)],
  ];

  totalRows.forEach(([label, value], index) => {
    const y = boxY + 20 + index * 18;
    doc.setFont('helvetica', index === totalRows.length - 1 ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    doc.text(label, width - 232, y);
    doc.text(value, width - 58, y, { align: 'right' });
  });

  if (link) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(37, 99, 235);
    doc.textWithLink('Consultar documento en Hacienda', 40, boxY + 22, { url: link });
    doc.setTextColor(100, 116, 139);
    doc.text(doc.splitTextToSize(link, 280), 40, boxY + 40);
  }

  addFooter(doc, template);
  return doc.output('blob');
};
