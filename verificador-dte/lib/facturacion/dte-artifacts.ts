import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

type Row = Record<string, unknown>;

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function money(value: unknown) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number);
}

function numberValue(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function sanitizeDteFileName(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, '_') || 'dte';
}

export function getDteFinalPackage(data: Row) {
  return asRecord(data.finalPackage || data);
}

export function getDteCode(data: Row, id: string) {
  const finalPackage = getDteFinalPackage(data);
  const dte = asRecord(finalPackage.dteJson || asRecord(data.documentResponse).dteJson || {});
  const identificacion = asRecord(dte.identificacion);
  return getString(data.codigoGeneracion || identificacion.codigoGeneracion || id);
}

export function buildDteJsonBuffer(data: Row) {
  return Buffer.from(JSON.stringify(buildClientDteJson(data), null, 2), 'utf8');
}

function emitField(doc: jsPDF, label: string, value: unknown, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  doc.text(getString(value) || '-', x + 34, y);
}

function buildClientDteJson(data: Row) {
  const finalPackage = getDteFinalPackage(data);
  const dte = asRecord(finalPackage.dteJson || asRecord(data.documentResponse).dteJson || {});
  const identificacion = asRecord(dte.identificacion);
  const tipoDte = getString(data.tipoDte || identificacion.tipoDte);

  if (tipoDte === '14') {
    const output: Row = {
      identificacion: dte.identificacion ?? null,
      emisor: dte.emisor ?? null,
      receptor: dte.receptor ?? null,
      cuerpoDocumento: dte.cuerpoDocumento ?? [],
      resumen: dte.resumen ?? null,
      firmaElectronica: getString(finalPackage.firma || data.firma) || null,
      selloRecibido: getString(finalPackage.selloRecepcion || data.selloRecepcion) || null,
      apendice: dte.apendice ?? null,
    };
    return output;
  }

  const output: Row = {
    identificacion: dte.identificacion ?? null,
    documentoRelacionado: dte.documentoRelacionado ?? null,
    emisor: dte.emisor ?? null,
    receptor: dte.receptor ?? null,
    otrosDocumentos: dte.otrosDocumentos ?? null,
    ventaTercero: dte.ventaTercero ?? null,
    cuerpoDocumento: dte.cuerpoDocumento ?? [],
    resumen: dte.resumen ?? null,
    firmaElectronica: getString(finalPackage.firma || data.firma) || null,
    selloRecibido: getString(finalPackage.selloRecepcion || data.selloRecepcion) || null,
  };

  if ('extension' in dte) output.extension = dte.extension;
  if ('apendice' in dte) output.apendice = dte.apendice;
  return output;
}

function tributosText(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return '-';
  return value.map((item) => {
    const row = asRecord(item);
    return [row.codigo, row.descripcion, row.valor].map(getString).filter(Boolean).join(' ');
  }).filter(Boolean).join(', ') || '-';
}

function qrUrl(identificacion: Row, codigo: string) {
  const ambiente = getString(identificacion.ambiente) || '00';
  const fecha = getString(identificacion.fecEmi);
  return `https://admin.factura.gob.sv/consultaPublica?ambiente=${encodeURIComponent(ambiente)}&codGen=${encodeURIComponent(codigo)}&fechaEmi=${encodeURIComponent(fecha)}`;
}

function drawBox(doc: jsPDF, title: string, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(205, 210, 218);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 1.8, 1.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text(title, x + w / 2, y + 5, { align: 'center' });
}

function smallField(doc: jsPDF, label: string, value: unknown, x: number, y: number, labelWidth = 23, maxWidth = 54) {
  doc.setFontSize(6.3);
  doc.setFont('helvetica', 'bold');
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  const text = doc.splitTextToSize(getString(value) || '-', maxWidth);
  doc.text(text.slice(0, 2), x + labelWidth, y);
}

function drawWrappedCell(
  doc: jsPDF,
  text: unknown,
  x: number,
  y: number,
  w: number,
  h: number,
  options: { bold?: boolean; align?: 'left' | 'center' | 'right'; fontSize?: number; fill?: [number, number, number] } = {}
) {
  if (options.fill) {
    doc.setFillColor(...options.fill);
    doc.rect(x, y, w, h, 'F');
  }
  doc.setDrawColor(203, 209, 217);
  doc.setLineWidth(0.18);
  doc.rect(x, y, w, h);
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  doc.setFontSize(options.fontSize || 5.5);
  doc.setTextColor(17, 24, 39);
  const padding = 1.2;
  const lines = doc.splitTextToSize(getString(text) || '-', Math.max(1, w - padding * 2)).slice(0, Math.max(1, Math.floor(h / 3)));
  const textX = options.align === 'right' ? x + w - padding : options.align === 'center' ? x + w / 2 : x + padding;
  const textY = y + 3.2;
  doc.text(lines, textX, textY, { align: options.align || 'left' });
}

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number, w: number) {
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, w, 8, 1.4, 1.4, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(title, x + w / 2, y + 5.3, { align: 'center' });
}

export async function buildDtePdfBuffer(data: Row, id: string) {
  const finalPackage = getDteFinalPackage(data);
  const dte = asRecord(finalPackage.dteJson || asRecord(data.documentResponse).dteJson || {});
  const identificacion = asRecord(dte.identificacion);
  const emisor = asRecord(dte.emisor);
  const receptor = asRecord(dte.receptor);
  const resumen = asRecord(dte.resumen);
  const cuerpo = Array.isArray(dte.cuerpoDocumento) ? dte.cuerpoDocumento.map(asRecord) : [];
  const tipoDte = getString(data.tipoDte || identificacion.tipoDte);
  const titulo = tipoDte === '03'
    ? 'COMPROBANTE DE CREDITO FISCAL'
    : tipoDte === '14'
      ? 'FACTURA DE SUJETO EXCLUIDO'
      : 'FACTURA';
  const codigo = getDteCode(data, id);

  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const qrDataUrl = await QRCode.toDataURL(qrUrl(identificacion, codigo), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 180,
  });

  const marginX = 12;
  const contentW = pageWidth - marginX * 2;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(marginX, 10, contentW, 32, 3, 3, 'F');
  doc.setFillColor(234, 179, 8);
  doc.rect(marginX, 39, contentW, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DOCUMENTO TRIBUTARIO ELECTRONICO', marginX + 8, 21);
  doc.setFontSize(15);
  doc.text(titulo, marginX + 8, 31);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(getString(emisor.nombre) || 'Emisor', marginX + 8, 37);
  doc.setFont('helvetica', 'bold');
  doc.text(`Ver. ${getString(identificacion.version) || '-'}`, pageWidth - marginX - 8, 21, { align: 'right' });

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth - marginX - 37, 15, 28, 28, 2, 2, 'F');
  doc.addImage(qrDataUrl, 'PNG', pageWidth - marginX - 35.5, 16.5, 25, 25);

  doc.setTextColor(15, 23, 42);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, 48, contentW, 28, 2, 2);
  smallField(doc, 'Codigo generacion:', codigo, marginX + 6, 57, 27, 70);
  smallField(doc, 'Numero control:', data.numeroControl || identificacion.numeroControl, marginX + 6, 65, 27, 70);
  smallField(doc, 'Sello recepcion:', data.selloRecepcion || finalPackage.selloRecepcion, marginX + 6, 73, 27, 70);
  smallField(doc, 'Modelo:', identificacion.tipoModelo, marginX + 116, 57, 20, 42);
  smallField(doc, 'Transmision:', identificacion.tipoOperacion, marginX + 116, 65, 20, 42);
  smallField(doc, 'Fecha/Hora:', `${getString(identificacion.fecEmi)} ${getString(identificacion.horEmi)}`, marginX + 116, 73, 20, 42);

  drawBox(doc, 'EMISOR', marginX, 83, 91, 40);
  drawBox(doc, 'RECEPTOR', marginX + 97, 83, 91, 40);
  smallField(doc, 'Nombre:', emisor.nombre, marginX + 4, 94, 17, 62);
  smallField(doc, 'NIT:', emisor.nit, marginX + 4, 100, 17, 62);
  smallField(doc, 'NRC:', emisor.nrc, marginX + 4, 106, 17, 62);
  smallField(doc, 'Actividad:', emisor.descActividad, marginX + 4, 112, 17, 62);
  smallField(doc, 'Correo:', emisor.correo, marginX + 4, 120, 17, 62);
  smallField(doc, 'Nombre:', receptor.nombre, marginX + 101, 94, 20, 58);
  smallField(doc, tipoDte === '03' ? 'NIT:' : 'Documento:', receptor.nit || receptor.numDocumento, marginX + 101, 100, 20, 58);
  smallField(doc, 'NRC:', receptor.nrc, marginX + 101, 106, 20, 58);
  smallField(doc, 'Actividad:', receptor.descActividad, marginX + 101, 112, 20, 58);
  smallField(doc, 'Correo:', receptor.correo, marginX + 101, 120, 20, 58);

  drawSectionTitle(doc, 'VENTA POR CUENTA DE TERCEROS', marginX, 130, contentW);
  drawSectionTitle(doc, 'DOCUMENTOS RELACIONADOS', marginX, 142, contentW);
  drawSectionTitle(doc, 'OTROS DOCUMENTOS ASOCIADOS', marginX, 154, contentW);

  let tableY = 169;
  const excludedSubject = tipoDte === '14';
  const headers = excludedSubject
    ? ['N', 'Cant.', 'Unidad', 'Codigo', 'Descripcion', 'Precio', 'Desc.', 'Compra']
    : ['N', 'Cant.', 'Unidad', 'Codigo', 'Descripcion', 'Precio', 'Desc.', 'No Afecto', 'No Suj.', 'Exenta', 'Gravada'];
  const widths = excludedSubject
    ? [7, 12, 12, 18, 67, 18, 18, 21]
    : [7, 12, 10, 15, 38, 15, 14, 16, 16, 15, 15];
  const rowH = 9;
  const headerH = 13;
  let x = marginX;
  headers.forEach((header, index) => {
    drawWrappedCell(doc, header, x, tableY, widths[index], headerH, {
      bold: true,
      align: 'center',
      fontSize: 5.2,
      fill: [241, 245, 249],
    });
    x += widths[index];
  });
  tableY += headerH;

  const drawItemRow = (item: Row) => {
    if (tableY + rowH > pageHeight - 54) {
      doc.addPage();
      tableY = 18;
    }
    const row = excludedSubject
      ? [
          getString(item.numItem),
          getString(item.cantidad),
          getString(item.uniMedida),
          getString(item.codigo),
          getString(item.descripcion),
          money(item.precioUni),
          money(item.montoDescu),
          money(item.compra),
        ]
      : [
          getString(item.numItem),
          getString(item.cantidad),
          getString(item.uniMedida),
          getString(item.codigo),
          getString(item.descripcion),
          money(item.precioUni),
          money(item.montoDescu),
          money(item.noGravado),
          money(item.ventaNoSuj),
          money(item.ventaExenta),
          money(item.ventaGravada),
        ];
    let rowX = marginX;
    row.forEach((value, index) => {
      drawWrappedCell(doc, value, rowX, tableY, widths[index], rowH, {
        align: index === 4 ? 'left' : index < 4 ? 'center' : 'right',
        fontSize: 5.4,
      });
      rowX += widths[index];
    });
    tableY += rowH;
  };

  if (cuerpo.length) {
    cuerpo.forEach(drawItemRow);
  } else {
    drawItemRow({ numItem: 1, descripcion: 'Sin items' });
  }

  const totalNoSuj = numberValue(resumen.totalNoSuj);
  const totalExenta = numberValue(resumen.totalExenta);
  const totalGravada = numberValue(resumen.totalGravada);
  const ivaPerci = numberValue(resumen.ivaPerci || resumen.ivaPerci1);
  const ivaRete = numberValue(resumen.ivaRete || resumen.ivaRete1);
  const reteRenta = numberValue(resumen.reteRenta);
  const totalIva = numberValue(resumen.totalIva);

  if (tableY + 74 > pageHeight - 24) {
    doc.addPage();
    tableY = 18;
  }

  const summaryRows = excludedSubject
    ? [
        ['Total compra', money(resumen.totalCompra)],
        ['Descuento', money(resumen.descu)],
        ['Total descuento', money(resumen.totalDescu)],
        ['Sub-Total', money(resumen.subTotal)],
        ['Retencion Renta', money(reteRenta)],
        ['Total a Pagar', money(resumen.totalPagar)],
      ]
    : [
        ['Suma de Ventas', `${money(totalNoSuj)} / ${money(totalExenta)} / ${money(totalGravada)}`],
        ['Sumatoria de ventas', money(resumen.subTotalVentas)],
        ['Descuento global a ventas no sujetas', money(resumen.descuNoSuj)],
        ['Descuento global a ventas exentas', money(resumen.descuExenta)],
        ['Descuento global a ventas gravadas', money(resumen.descuGravada)],
        ['Nombre del Tributo', tributosText(resumen.tributos)],
        ['Sub-Total', money(resumen.subTotal)],
        ...(totalIva ? [['IVA', money(totalIva)]] : []),
        ...(ivaPerci ? [['IVA Percibido', money(ivaPerci)]] : []),
        ['IVA Retenido', money(ivaRete)],
        ...(reteRenta ? [['Retencion Renta', money(reteRenta)]] : []),
        ['Monto Total de la Operacion', money(resumen.montoTotalOperacion)],
        ['Total Otros Montos No Afectos', money(resumen.totalNoGravado)],
        ['Total a Pagar', money(resumen.totalPagar)],
      ];
  const summaryX = marginX + 96;
  const summaryLabelW = 62;
  const summaryValueW = contentW - 96 - summaryLabelW;
  const summaryRowH = 6.4;
  tableY += 4;
  summaryRows.forEach(([label, value], index) => {
    if (tableY + summaryRowH > pageHeight - 30) {
      doc.addPage();
      tableY = 18;
    }
    const fill: [number, number, number] = index % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
    const isTotal = label === 'Total a Pagar';
    drawWrappedCell(doc, label, summaryX, tableY, summaryLabelW, summaryRowH, {
      align: 'right',
      bold: true,
      fontSize: isTotal ? 6.4 : 5.9,
      fill,
    });
    drawWrappedCell(doc, value, summaryX + summaryLabelW, tableY, summaryValueW, summaryRowH, {
      align: 'right',
      bold: isTotal,
      fontSize: isTotal ? 6.4 : 5.9,
      fill,
    });
    tableY += summaryRowH;
  });

  const summaryY = tableY;
  const footerY = Math.min(summaryY + 8, pageHeight - 30);
  doc.setDrawColor(205, 210, 218);
  doc.roundedRect(18, footerY, 180, 16, 1.5, 1.5);
  smallField(doc, 'Valor en letras:', resumen.totalLetras, 22, footerY + 6, 24);
  smallField(doc, 'Observaciones:', resumen.observaciones, 22, footerY + 12, 24);
  doc.setFontSize(7);
  doc.text('Pagina 1 de 1', pageWidth - 16, pageHeight - 10, { align: 'right' });

  return Buffer.from(doc.output('arraybuffer'));
}
