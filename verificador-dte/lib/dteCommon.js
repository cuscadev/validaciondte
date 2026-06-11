// lib/dteCommon.js (ESM)
import * as XLSX from 'xlsx-js-style';

/* ========================= Constantes ========================= */
export const ADMIN = 'https://admin.factura.gob.sv/consultaPublica';
export const WEBAPP = 'https://webapp.dtes.mh.gob.sv/consultaPublica';

/* ========================= Utils ========================= */
const COD_RE = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

export const isProbableCodGen = (s) => !!s && COD_RE.test(String(s).trim());

export function normalizarEstado(t) {
  t = (t || '').toUpperCase();
  if (t.includes('ANULAD')) return 'ANULADO';
  if (t.includes('RECHAZAD')) return 'RECHAZADO';
  if (t.includes('TRANSMITIDO') || t.includes('REGISTRADO') || t.includes('SATISFACTORIAMENTE')) return 'EMITIDO';
  if (t.includes('INVALIDAD')) return 'INVALIDADO';
  if (t.includes('NO ENCONTRADO') || t.includes('NO EXISTE') || t.includes('NO SE ENCONTRÓ')) return 'NO ENCONTRADO';
  return 'DESCONOCIDO';
}

export function normalizarTipoDte(t) {
  t = (t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().trim();
  if (t === '01') return 'FACTURA';
  if (t === '03') return 'COMPROBANTE DE CRÉDITO FISCAL';
  if (t === '05') return 'NOTA DE CRÉDITO';
  if (t === '06') return 'NOTA DE DÉBITO';
  if (t === '07') return 'COMPROBANTE DE RETENCIÓN';
  if (t === '09') return 'COMPROBANTE DE LIQUIDACIÓN';
  if (t === '11') return 'FACTURA DE EXPORTACIÓN';
  if (t === '14') return 'FACTURA SUJETO EXCLUIDO';
  if (t === '15') return 'COMPROBANTE DE DONACIÓN';
  if (t.includes('FACTURA') && t.includes('SUJETO') && t.includes('EXCLUIDO')) return 'FACTURA SUJETO EXCLUIDO';
  if (t.includes('FACTURA') && t.includes('EXPORT')) return 'FACTURA DE EXPORTACIÓN';
  if (t.includes('LIQUIDACION')) return 'COMPROBANTE DE LIQUIDACIÓN';
  if (t.includes('RETENCION')) return 'COMPROBANTE DE RETENCIÓN';
  if (t.includes('DONACION')) return 'COMPROBANTE DE DONACIÓN';
  if (t.includes('FACTURA')) return 'FACTURA';
  if (t.includes('COMPROBANTE') && t.includes('CREDITO') && t.includes('FISCAL')) return 'COMPROBANTE DE CRÉDITO FISCAL';
  if (t.includes('NOTA') && t.includes('DEBITO')) return 'NOTA DE DÉBITO';
  if (t.includes('NOTA') && t.includes('CREDITO')) return 'NOTA DE CRÉDITO';
  return 'SIN_TIPO';
}

export const buildQuery = (base, params) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
};

/* ========================= Fechas y lectura de archivos ========================= */
export function tryParseFechaFlexible(raw) {
  if (raw == null) return null;
  if (raw instanceof Date && !isNaN(raw)) return raw;
  if (typeof raw === 'number') {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isNaN(d)) return d;
  }
  const s = String(raw).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3]); if (!isNaN(d)) return d; }

  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) { const d = new Date(+m[3], +m[2] - 1, +m[1]); if (!isNaN(d)) return d; }

  const d2 = new Date(s);
  if (!isNaN(d2)) return d2;

  return null;
}

export function parseCSV_codFecha(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/[,\t;]+/).map((p) => p.trim());
    if (parts.length < 2) continue;
    const cg = parts[0];
    const fv = parts[1];

    if (i === 0 && !isProbableCodGen(cg)) {
      const h0 = (parts[0] || '').toLowerCase();
      if (h0.includes('cod')) continue;
    }

    if (!isProbableCodGen(cg)) continue;
    const d = tryParseFechaFlexible(fv);
    if (!d) continue;

    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    out.push({ codGen: cg, fechaYmd: `${y}-${mo}-${dd}` });
  }
  return out;
}

export function parseXLSX_codFecha(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  const out = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    if (row.length < 2) continue;

    const cg = String(row[0] ?? '').trim();

    if (i === 0 && !isProbableCodGen(cg)) {
      const h0 = String(row[0] ?? '').toLowerCase();
      if (h0.includes('cod')) continue;
    }

    if (!isProbableCodGen(cg)) continue;

    const d = tryParseFechaFlexible(row[1]);
    if (!d) continue;

    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    out.push({ codGen: cg, fechaYmd: `${y}-${mo}-${dd}` });
  }
  return out;
}

/* ========================= Excel helpers ========================= */
export const sheetNameSafe = (name) => {
  const bad = /[:\\/?*\[\]]/g;
  let s = (name || 'Hoja').replace(bad, ' ').trim();
  if (s.length > 31) s = s.slice(0, 31);
  return s || 'Hoja';
};

export function applyHyperlinks(ws) {
  const ref = ws['!ref'];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const headers = {};
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c: C });
    const cell = ws[addr];
    if (cell && typeof cell.v === 'string') headers[cell.v] = C;
  }
  const colVisitar = headers.visitar;
  const colLink = headers.linkVisita;
  if (colVisitar === undefined || colLink === undefined) return;
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    const aV = XLSX.utils.encode_cell({ r: R, c: colVisitar });
    const aL = XLSX.utils.encode_cell({ r: R, c: colLink });
    const url = ws[aL]?.v;
    if (typeof url === 'string' && url) {
      ws[aV] = ws[aV] || { t: 's', v: 'Abrir' };
      ws[aV].l = { Target: url };
    }
  }
}

const sheetHeaders = (ws) => {
  const ref = ws['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const headers = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c: C });
    headers.push(ws[addr]?.v?.toString?.() || '');
  }
  return headers;
};

const thinBorder = {
  top: { style: 'thin', color: { rgb: 'E5E7EB' } },
  bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
  left: { style: 'thin', color: { rgb: 'E5E7EB' } },
  right: { style: 'thin', color: { rgb: 'E5E7EB' } },
};

export function prepareReportSheet(ws) {
  const ref = ws['!ref'];
  if (!ref) return ws;
  const range = XLSX.utils.decode_range(ref);
  const headers = sheetHeaders(ws);
  ws['!autofilter'] = { ref };
  ws['!cols'] = headers.map((header) => ({
    wch: Math.min(Math.max(String(header || '').length + 4, 14), 34),
  }));
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c: C });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, color: { rgb: '111827' } },
        fill: { fgColor: { rgb: 'FACC15' } },
        alignment: { horizontal: 'center' },
        border: thinBorder,
      };
    }
  }
  return ws;
}

export function buildReportSummarySheet(resultados, wsAll, options = {}) {
  const now = new Date();
  const byType = new Map();
  const byStatus = new Map();
  const generatedBy = options.generatedBy || 'Reporte generado automáticamente por el Sistema de Verificación de DTEs';

  for (const row of resultados) {
    const type = row?.tipoDteNorm || row?.tipoDte || row?.tipo || 'SIN_TIPO';
    const status = row?.estado || 'SIN_ESTADO';
    byType.set(type, (byType.get(type) || 0) + 1);
    byStatus.set(status, (byStatus.get(status) || 0) + 1);
  }

  const typeEntries = Array.from(byType.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const statusEntries = Array.from(byStatus.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  const formattedDate = now.toLocaleString('es-SV', { timeZone: 'America/El_Salvador' });

  const rows = [
    ['REPORTE DE VERIFICACIÓN DE DTEs', null, null],
    [null, null, null],
    ['Generado el', formattedDate, null],
    [null, null, null],
    ['Total de DTEs procesados', resultados.length, null],
    [null, null, null],
    ['RESUMEN POR TIPO DE DOCUMENTO', null, null],
    ['Tipo de DTE', 'Cantidad', 'Porcentaje'],
    ...typeEntries.map(([type, count]) => [type, count, resultados.length > 0 ? `${((count / resultados.length) * 100).toFixed(2)}%` : '0%']),
    [null, null, null],
    ['RESUMEN POR ESTADO', null, null],
    ['Estado del Documento', 'Cantidad', 'Porcentaje'],
    ...statusEntries.map(([status, count]) => [status, count, resultados.length > 0 ? `${((count / resultados.length) * 100).toFixed(2)}%` : '0%']),
    [null, null, null],
    [generatedBy, null, null],
    ['Para más información, contacte al área de tributario', null, null],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 18 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: rows.length - 2, c: 0 }, e: { r: rows.length - 2, c: 2 } },
    { s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 2 } },
  ];

  const headerStyleMain = {
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '0B233F' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder,
  };

  const headerStyleDark = {
    font: { bold: true, sz: 13, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '0B233F' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: thinBorder,
  };

  const headerStyleMedium = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
    fill: { fgColor: { rgb: '1F2937' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  };

  const infoStyle = {
    font: { bold: false, color: { rgb: '111827' }, sz: 11 },
    fill: { fgColor: { rgb: 'F3F4F6' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  };

  const dataStyle = {
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  const footerStyle = {
    font: { bold: true, sz: 10, color: { rgb: '6B7280' } },
    fill: { fgColor: { rgb: 'F9FAFB' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  };

  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) continue;
      const value = ws[addr]?.v;

      if (R === 0) {
        ws[addr].s = headerStyleMain;
      } else if (value === null) {
        ws[addr].s = { fill: { fgColor: { rgb: 'FFFFFF' } } };
      } else if (R >= rows.length - 2) {
        ws[addr].s = footerStyle;
      } else if (value === 'RESUMEN POR TIPO DE DOCUMENTO' || value === 'RESUMEN POR ESTADO') {
        ws[addr].s = headerStyleDark;
        for (let CC = C; CC <= 2; ++CC) {
          const cellAddr = XLSX.utils.encode_cell({ r: R, c: CC });
          if (ws[cellAddr]) ws[cellAddr].s = headerStyleDark;
        }
      } else if (
        (value === 'Tipo de DTE' && ws[XLSX.utils.encode_cell({ r: R, c: C + 1 })]?.v === 'Cantidad')
        || (value === 'Estado del Documento' && ws[XLSX.utils.encode_cell({ r: R, c: C + 1 })]?.v === 'Cantidad')
      ) {
        for (let CC = 0; CC <= 2; ++CC) {
          const cellAddr = XLSX.utils.encode_cell({ r: R, c: CC });
          if (ws[cellAddr]) ws[cellAddr].s = headerStyleMedium;
        }
      } else if (value === 'Generado el' || value === 'Total de DTEs procesados') {
        ws[addr].s = infoStyle;
        const valueAddr = XLSX.utils.encode_cell({ r: R, c: 1 });
        if (ws[valueAddr]) ws[valueAddr].s = infoStyle;
      } else if (typeof value === 'number' || (typeof value === 'string' && value.includes('%'))) {
        ws[addr].s = { ...dataStyle, alignment: { horizontal: 'right', vertical: 'center' } };
      } else if (C === 0 && value) {
        ws[addr].s = { ...dataStyle, alignment: { horizontal: 'left', vertical: 'center' } };
      } else if (value) {
        ws[addr].s = dataStyle;
      }

      if (typeof ws[addr]?.v === 'number') {
        ws[addr].z = '0';
      }
    }
  }

  return ws;
}

const DEFAULT_REPORT_TYPE_SHEETS = [
  'FACTURA',
  'COMPROBANTE DE CRÉDITO FISCAL',
  'NOTA DE CRÉDITO',
  'COMPROBANTE DE RETENCIÓN',
  'COMPROBANTE DE LIQUIDACIÓN',
  'FACTURA SUJETO EXCLUIDO',
  'NOTA DE DÉBITO',
  'FACTURA DE EXPORTACIÓN',
  'COMPROBANTE DE DONACIÓN',
];

function reportTypeSheets(resultados) {
  const seen = new Set();
  const out = [];
  const appendType = (tipo) => {
    const value = String(tipo || '').trim();
    if (!value || value === 'SIN_TIPO' || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };
  DEFAULT_REPORT_TYPE_SHEETS.forEach(appendType);
  resultados.forEach((row) => appendType(row?.tipoDteNorm));
  return out;
}

function buildWorkbookTypeSheets(wb, normalizedResults) {
  for (const t of reportTypeSheets(normalizedResults)) {
    const rows = normalizedResults.filter((r) => r?.tipoDteNorm === t);
    if (!rows.length) continue;
    const ws = XLSX.utils.json_to_sheet(rows);
    applyHyperlinks(ws);
    prepareReportSheet(ws);
    XLSX.utils.book_append_sheet(wb, ws, sheetNameSafe(t));
  }
}

export function buildWorkbook(resultados, options = {}) {
  const wb = XLSX.utils.book_new();
  const normalizedResults = resultados.map((row) => ({
    ...row,
    tipoDteNorm: normalizarTipoDte(row?.tipoDteNorm || row?.tipoDte || row?.tipo || row?.TipoDte),
  }));

  const wsAll = XLSX.utils.json_to_sheet(normalizedResults);
  applyHyperlinks(wsAll);
  prepareReportSheet(wsAll);
  XLSX.utils.book_append_sheet(wb, buildReportSummarySheet(normalizedResults, wsAll, options), sheetNameSafe('Resumen'));
  XLSX.utils.book_append_sheet(wb, wsAll, sheetNameSafe('Todos'));

  buildWorkbookTypeSheets(wb, normalizedResults);

  const rechaz = normalizedResults.filter((r) => r?.estado === 'RECHAZADO' || r?.estado === 'INVALIDADO');
  const wsR = XLSX.utils.json_to_sheet(rechaz);
  applyHyperlinks(wsR);
  prepareReportSheet(wsR);
  XLSX.utils.book_append_sheet(wb, wsR, sheetNameSafe('Rechazados'));

  const relAll = [];
  for (const r of normalizedResults) {
    const parent = r.codGen || r.codigoGeneracion || '';
    const tipoPadre = r.tipoDte || '';
    if (Array.isArray(r.relacionados) && r.relacionados.length) {
      for (const rel of r.relacionados) {
        relAll.push({
          codGenPadre: parent,
          tipoDtePadre: tipoPadre,
          fechaGeneracion: rel.fechaGeneracion,
          codigoGeneracion: rel.codigoGeneracion,
          selloRecepcion: rel.selloRecepcion,
          tipoDocumentacion: rel.tipoDocumentacion,
          estado: rel.estado || '',
          estadoRaw: rel.estadoRaw || '',
          linkVisita: r.linkVisita || r.url,
          visitar: 'Abrir',
        });
      }
    }
  }
  if (relAll.length) {
    const wsRel = XLSX.utils.json_to_sheet(relAll);
    applyHyperlinks(wsRel);
    prepareReportSheet(wsRel);
    XLSX.utils.book_append_sheet(wb, wsRel, sheetNameSafe('Relacionados'));
  }

  return wb;
}

export function buildDteExcelBase64(resultados, options = {}) {
  const wb = buildWorkbook(resultados, options);
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return {
    excelBase64: Buffer.from(excelBuffer).toString('base64'),
    filename: `resultados_dtes_${Date.now()}.xlsx`,
  };
}

export { XLSX };
