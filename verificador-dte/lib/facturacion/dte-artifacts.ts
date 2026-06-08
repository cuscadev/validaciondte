import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  return {
    identificacion: dte.identificacion ?? null,
    documentoRelacionado: dte.documentoRelacionado ?? null,
    emisor: dte.emisor ?? null,
    receptor: dte.receptor ?? null,
    extension: dte.extension ?? {
      nombEntrega: null,
      docuEntrega: null,
      nombRecibe: null,
      docuRecibe: null,
      observaciones: null,
      placaVehiculo: null,
    },
    apendice: dte.apendice ?? null,
    ventaTercero: dte.ventaTercero ?? null,
    otrosDocumentos: dte.otrosDocumentos ?? null,
    cuerpoDocumento: dte.cuerpoDocumento ?? [],
    resumen: dte.resumen ?? null,
    firmaElectronica: getString(finalPackage.firma || data.firma) || null,
    selloRecibido: getString(finalPackage.selloRecepcion || data.selloRecepcion) || null,
  };
}

function tributosText(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return '-';
  return value.map((item) => {
    const row = asRecord(item);
    return [row.codigo, row.descripcion, row.valor].map(getString).filter(Boolean).join(' ');
  }).filter(Boolean).join(', ') || '-';
}

export function buildDtePdfBuffer(data: Row, id: string) {
  const finalPackage = getDteFinalPackage(data);
  const dte = asRecord(finalPackage.dteJson || asRecord(data.documentResponse).dteJson || {});
  const identificacion = asRecord(dte.identificacion);
  const emisor = asRecord(dte.emisor);
  const receptor = asRecord(dte.receptor);
  const resumen = asRecord(dte.resumen);
  const cuerpo = Array.isArray(dte.cuerpoDocumento) ? dte.cuerpoDocumento.map(asRecord) : [];
  const tipoDte = getString(data.tipoDte || identificacion.tipoDte);
  const titulo = tipoDte === '03' ? 'COMPROBANTE DE CREDITO FISCAL' : 'FACTURA';
  const codigo = getDteCode(data, id);

  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DOCUMENTO TRIBUTARIO ELECTRONICO', pageWidth / 2, 16, { align: 'center' });
  doc.text(titulo, pageWidth / 2, 22, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ver. ${getString(identificacion.version) || '-'}`, pageWidth - 16, 12, { align: 'right' });

  emitField(doc, 'Codigo generacion:', codigo, 16, 34);
  emitField(doc, 'Numero control:', data.numeroControl || identificacion.numeroControl, 16, 40);
  emitField(doc, 'Sello recepcion:', data.selloRecepcion || finalPackage.selloRecepcion, 16, 46);
  emitField(doc, 'Modelo:', identificacion.tipoModelo, 178, 34);
  emitField(doc, 'Operacion:', identificacion.tipoOperacion, 178, 40);
  emitField(doc, 'Fecha/Hora:', `${getString(identificacion.fecEmi)} ${getString(identificacion.horEmi)}`, 178, 46);

  doc.setDrawColor(190);
  doc.roundedRect(14, 56, 120, 42, 2, 2);
  doc.roundedRect(148, 56, 120, 42, 2, 2);
  doc.setFont('helvetica', 'bold');
  doc.text('EMISOR', 74, 62, { align: 'center' });
  doc.text('RECEPTOR', 208, 62, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  emitField(doc, 'Nombre:', emisor.nombre, 18, 70);
  emitField(doc, 'NIT:', emisor.nit, 18, 76);
  emitField(doc, 'NRC:', emisor.nrc, 18, 82);
  emitField(doc, 'Actividad:', emisor.descActividad, 18, 88);
  emitField(doc, 'Correo:', emisor.correo, 18, 94);
  emitField(doc, 'Nombre:', receptor.nombre, 152, 70);
  emitField(doc, tipoDte === '03' ? 'NIT:' : 'Documento:', receptor.nit || receptor.numDocumento, 152, 76);
  emitField(doc, 'NRC:', receptor.nrc, 152, 82);
  emitField(doc, 'Actividad:', receptor.descActividad, 152, 88);
  emitField(doc, 'Correo:', receptor.correo, 152, 94);

  autoTable(doc, {
    startY: 106,
    margin: { left: 10, right: 10 },
    head: [[
      'N',
      'Cantidad',
      'Unidad',
      'Codigo',
      'Descripcion',
      'Precio\nUnitario',
      'Descuento\npor item',
      'Otros Montos\nNo Afectos',
      'Ventas\nNo Sujetas',
      'Ventas\nExentas',
      'Ventas\nGravadas',
    ]],
    body: cuerpo.map((item) => [
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
    ]),
    styles: { fontSize: 6.2, cellPadding: 1.1, lineColor: [180, 180, 180], lineWidth: 0.1, overflow: 'linebreak', minCellWidth: 0 },
    headStyles: { fillColor: [255, 255, 255], textColor: [20, 20, 20], halign: 'center', fontStyle: 'bold', overflow: 'linebreak' },
    bodyStyles: { valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 14, halign: 'right' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 15 },
      4: { cellWidth: 42 },
      5: { cellWidth: 15, halign: 'right' },
      6: { cellWidth: 17, halign: 'right' },
      7: { cellWidth: 28, halign: 'right' },
      8: { cellWidth: 22, halign: 'right' },
      9: { cellWidth: 22, halign: 'right' },
      10: { cellWidth: 22, halign: 'right' },
    },
    theme: 'grid',
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 130;
  const totalNoSuj = numberValue(resumen.totalNoSuj);
  const totalExenta = numberValue(resumen.totalExenta);
  const totalGravada = numberValue(resumen.totalGravada);
  const ivaPerci = numberValue(resumen.ivaPerci || resumen.ivaPerci1);
  const ivaRete = numberValue(resumen.ivaRete || resumen.ivaRete1);
  const reteRenta = numberValue(resumen.reteRenta);
  const totalIva = numberValue(resumen.totalIva);
  autoTable(doc, {
    startY: finalY + 6,
    margin: { left: 148, right: 10 },
    body: [
      ['Suma de Ventas', `${money(totalNoSuj)}   ${money(totalExenta)}   ${money(totalGravada)}`],
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
    ],
    styles: { fontSize: 7.6, cellPadding: 1.4, lineColor: [180, 180, 180], lineWidth: 0.1, overflow: 'linebreak', minCellWidth: 0 },
    columnStyles: { 0: { fontStyle: 'bold', halign: 'right', cellWidth: 92 }, 1: { halign: 'right', cellWidth: 28 } },
    theme: 'grid',
  });

  const summaryY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || finalY + 44;
  emitField(doc, 'Valor en letras:', resumen.totalLetras, 16, summaryY + 10);
  emitField(doc, 'Observaciones:', resumen.observaciones, 16, summaryY + 16);
  doc.setFontSize(7);
  doc.text('Pagina 1 de 1', pageWidth - 16, pageHeight - 10, { align: 'right' });

  return Buffer.from(doc.output('arraybuffer'));
}
