// lib/dteCommon.js (ESM)
import { chromium as pwCore } from 'playwright-core';
import chromium from '@sparticuz/chromium';
import * as XLSX from 'xlsx-js-style';
import { load as cheerioLoad } from 'cheerio';

/* ========================= Constantes ========================= */
export const ADMIN  = 'https://admin.factura.gob.sv/consultaPublica';
export const WEBAPP = 'https://webapp.dtes.mh.gob.sv/consultaPublica';

/* ========================= Utils ========================= */
const limpiar = s => (s || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
const sinAcentos = s => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '');

function normalizeHeader(s) {
  return sinAcentos(limpiar(s)).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function indexOfHeader(headers, needle, fallback = 0) {
  const idx = headers.findIndex(h => h.includes(needle));
  return idx >= 0 ? idx : fallback;
}

function indexOfHeaderAny(headers, needles, fallback = 0) {
  for (const needle of needles) {
    const idx = headers.findIndex(h => h.includes(needle));
    if (idx >= 0) return idx;
  }
  return fallback;
}

function indexOfTipoHeader(headers) {
  const idx = indexOfHeaderAny(headers, ['tipo de documento', 'tipo de documentacion'], -1);
  if (idx >= 0) return idx;
  const split = headers.findIndex(h => h.includes('tipo') && h.includes('documento'));
  if (split >= 0) return split;
  return headers.length > 0 ? headers.length - 1 : 4;
}

function tableHeadersFromCheerio($, table) {
  return $(table).find('thead th, tr:first-child th').toArray().map(th => normalizeHeader($(th).text()));
}

function formatObservacionesTexto(observaciones) {
  if (!Array.isArray(observaciones) || !observaciones.length) return '';
  return observaciones.map(o => `${o.numero}. ${o.observacion}`).join('\n');
}

function formatRelacionadosTexto(relacionados) {
  if (!Array.isArray(relacionados) || !relacionados.length) return '';
  return relacionados.map((rel, i) => [
    `${i + 1}. ${rel.tipoDocumentacion}`,
    rel.codigoGeneracion,
    rel.fechaGeneracion,
    rel.selloRecepcion,
  ].join(' | ')).join('\n');
}
const COD_RE = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

export const isProbableCodGen = s => !!s && COD_RE.test(String(s).trim());

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
  t = sinAcentos((t || '').toUpperCase());
  if (t.includes('FACTURA')) return 'FACTURA';
  if (t.includes('COMPROBANTE') && t.includes('CREDITO') && t.includes('FISCAL')) return 'COMPROBANTE DE CRÉDITO FISCAL';
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
    // serial Excel (desde 1900-01-00)
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isNaN(d)) return d;
  }
  const s = String(raw).trim();
  if (!s) return null;

  // yyyy-MM-dd
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3]); if (!isNaN(d)) return d; }

  // dd/MM/yyyy o dd-MM-yyyy
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) { const d = new Date(+m[3], +m[2] - 1, +m[1]); if (!isNaN(d)) return d; }

  const d2 = new Date(s);
  if (!isNaN(d2)) return d2;

  return null;
}

export function parseCSV_codFecha(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/[,\t;]+/).map(p => p.trim());
    if (parts.length < 2) continue;
    const cg = parts[0]; const fv = parts[1];

    if (i === 0 && !isProbableCodGen(cg)) {
      const h0 = (parts[0] || '').toLowerCase();
      if (h0.includes('cod')) continue; // encabezado
    }

    if (!isProbableCodGen(cg)) continue;
    const d = tryParseFechaFlexible(fv); if (!d) continue;

    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    out.push({ codGen: cg, fechaYmd: `${y}-${m}-${dd}` });
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
      if (h0.includes('cod')) continue; // encabezado
    }

    if (!isProbableCodGen(cg)) continue;

    const d = tryParseFechaFlexible(row[1]);
    if (!d) continue;

    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    out.push({ codGen: cg, fechaYmd: `${y}-${m}-${dd}` });
  }
  return out;
}

/* ========================= Playwright ========================= */
export async function launchBrowser() {
  const isServerless = process.env.VERCEL === '1' || !!process.env.AWS_REGION || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (isServerless) {
    const exePath = await chromium.executablePath();
    return pwCore.launch({
      headless: true,
      executablePath: exePath || undefined,
      args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage'],
    });
  }
  // Local dev: usa el chromium de Playwright con navegadores instalados
  try {
    return await pwCore.launch({ headless: true, channel: 'msedge' });
  } catch {
    try {
      return await pwCore.launch({ headless: true, channel: 'chrome' });
    } catch {
      // fallback a chromium empaquetado por Playwright
      const { chromium } = await import('playwright');
      return chromium.launch({ headless: true });
    }
  }
}

export async function optimizarPagina(page) {
  await page.route('**/*', route => {
    const t = route.request().resourceType();
    if (t === 'image' || t === 'media' || t === 'font' || t === 'stylesheet') return route.abort();
    return route.continue();
  });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-SV,es;q=0.9,en;q=0.8' });
  await page.setViewportSize({ width: 1280, height: 900 });
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(20000);
}

/* ========================= Scrape cache / retry ========================= */
const scrapeCache = new Map();
const SCRAPE_CACHE_TTL_MS = Number(process.env.DTE_SCRAPE_CACHE_TTL_MS || 600_000);

function cacheKeyFromURL(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString().toUpperCase();
  } catch {
    return String(url || '').toUpperCase();
  }
}

function getCachedScrape(url) {
  const key = cacheKeyFromURL(url);
  const entry = scrapeCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    scrapeCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCachedScrape(url, result) {
  if (!result || result.estado === 'ERROR' || result.error) return;
  scrapeCache.set(cacheKeyFromURL(url), {
    result,
    expiresAt: Date.now() + SCRAPE_CACHE_TTL_MS,
  });
}

function shouldRetryScrape(result) {
  if (!result) return true;
  if (result.error) return true;
  if (result.estado === 'ERROR') return true;
  return false;
}

async function consultWithRetry(page, url) {
  const cached = getCachedScrape(url);
  if (cached) return cached;

  let result = await consultarConClick(page, url);
  if (!shouldRetryScrape(result)) {
    setCachedScrape(url, result);
    return result;
  }

  result = await consultarConClick(page, url);
  if (!shouldRetryScrape(result)) {
    setCachedScrape(url, result);
  }
  return result;
}

const MIN_INTERVAL_MS = Number(process.env.DTE_MIN_INTERVAL_MS || 0);
let lastScrapeAt = 0;

async function rateLimitScrape() {
  if (MIN_INTERVAL_MS <= 0) return;
  const now = Date.now();
  const wait = lastScrapeAt + MIN_INTERVAL_MS - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastScrapeAt = Date.now();
}

let sharedBrowserPromise = null;

export async function getSharedBrowser() {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = launchBrowser();
  }
  return sharedBrowserPromise;
}

class PagePool {
  constructor(ctx, size) {
    this.ctx = ctx;
    this.size = Math.max(1, size);
    this.pages = [];
    this.available = [];
    this.waiters = [];
  }

  async init() {
    for (let i = 0; i < this.size; i++) {
      const page = await this.ctx.newPage();
      await optimizarPagina(page);
      this.pages.push(page);
      this.available.push(page);
    }
  }

  async acquire() {
    if (this.available.length) return this.available.pop();
    return new Promise(resolve => this.waiters.push(resolve));
  }

  release(page) {
    if (this.waiters.length) {
      this.waiters.shift()(page);
      return;
    }
    this.available.push(page);
  }

  async close() {
    await Promise.all(this.pages.map(p => p.close().catch(() => {})));
    this.pages = [];
    this.available = [];
  }
}

export async function createPagePool(ctx, size = 2) {
  const pool = new PagePool(ctx, size);
  await pool.init();
  return pool;
}

const scrapeReadyPredicate = () => {
  const bodyText = document.body?.innerText || '';
  const text = bodyText.toLowerCase();
  const basic = text.includes('estado del dte')
    || text.includes('estado del documento')
    || text.includes('no encontrado')
    || text.includes('no existe')
    || text.includes('transmitido satisfactoriamente')
    || text.includes('rechazado')
    || text.includes('invalidado');
  if (!basic) return false;

  const needsRelated = text.includes('documentos relacionados')
    || text.includes('documento ha sido ajustado');
  if (!needsRelated) return true;

  const uuids = bodyText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || [];
  return uuids.length >= 2;
};

async function waitForScrapeReady(target) {
  const deadline = Date.now() + 12000;
  let basicSeen = false;
  while (Date.now() < deadline) {
    const ready = await target.evaluate(scrapeReadyPredicate).catch(() => false);
    if (ready) {
      await new Promise(r => setTimeout(r, 150));
      return;
    }
    const bodyText = await target.evaluate(() => (document.body?.innerText || '')).catch(() => '');
    const text = bodyText.toLowerCase();
    if (
      text.includes('estado del dte') ||
      text.includes('estado del documento') ||
      text.includes('no encontrado') ||
      text.includes('no existe') ||
      text.includes('transmitido satisfactoriamente') ||
      text.includes('rechazado') ||
      text.includes('invalidado')
    ) {
      basicSeen = true;
    }
    await new Promise(r => setTimeout(r, basicSeen ? 80 : 150));
  }
  throw new Error('pagina no lista para scrape');
}

async function getResultadoScope(page) {
  const estadoSelectors = [
    'text=/Estado\\s+del\\s+DTE/i',
    'text=/Estado\\s+del\\s+documento/i',
  ];

  for (const target of [page, ...page.frames()]) {
    for (const selector of estadoSelectors) {
      try {
        await target.waitForSelector(selector, { timeout: 5000 });
        await waitForScrapeReady(target);
        return { html: await target.content() };
      } catch {}
    }
  }

  await waitForScrapeReady(page);
  return { html: await page.content() };
}

/* ========================= Parseo HTML ========================= */
const looksLikeButton = (s) => /realizar\s+b(ú|u)squeda/i.test(s);

function paresDesdeHtml(html) {
  const $ = cheerioLoad(html);
  const pares = {};

  const add = (k, v) => {
    k = limpiar(k).replace(/:$/, '');
    v = limpiar(v);
    if (!k || !v) return;
    if (looksLikeButton(v)) return; // evita "Realizar Búsqueda"
    pares[k] = v; // guarda la versión más limpia
  };

  // 1) Tablas <th>/<td> o <td>/<td>
  $('table').each((_, tbl) => {
    $(tbl).find('tr').each((__, tr) => {
      const cells = $(tr).children('th,td').toArray();
      if (cells.length >= 2) {
        for (let i = 0; i < cells.length - 1; i++) {
          const k = $(cells[i]).text();
          const v = $(cells[i + 1]).text();
          if (/:$/.test(limpiar(k)) || limpiar(k).length <= 50) add(k, v);
        }
      }
    });
  });

  // 2) Listas de definición <dt>/<dd>
  $('dl dt').each((_, dt) => {
    const dd = $(dt).nextAll('dd').first();
    if (dd.length) add($(dt).text(), dd.text());
  });

  // 3) Fallback: cualquier nodo que termine con ':' y su siguiente nodo con texto
  $('*').each((_, el) => {
    const t = limpiar($(el).text());
    if (!/:$/.test(t)) return;

    // siguiente hermano con texto
    let nxt = $(el).next();
    while (nxt.length && !limpiar(nxt.text())) nxt = nxt.next();
    if (nxt.length) add(t, nxt.text());

    // o primer nodo de texto dentro del mismo contenedor
    const sibling = $(el).parent().contents().toArray().find(n => n !== el && limpiar($(n).text()));
    if (sibling) add(t, $(sibling).text());
  });

  return pares;
}

function mapearDetalle(p) {
  const g = k => p[k] || '';
  const estadoRaw = g('Estado del documento') || g('Estado del Documento');
  const documentoAjustado = g('Documento ajustado');
  const ajustado = /ajustad/i.test(documentoAjustado);
  const tipoDte = g('Tipo de DTE');
  return {
    estado: normalizarEstado(estadoRaw),
    estadoRaw,
    tipoDte,
    tipoDteNorm: normalizarTipoDte(tipoDte),
    descripcionEstado: g('Descripción del Estado') || g('Descripcion del Estado'),
    fechaHoraGeneracion: g('Fecha y Hora de Generación') || g('Fecha y Hora de Generacion'),
    fechaHoraProcesamiento: g('Fecha y Hora de Procesamiento'),
    codigoGeneracion: g('Código de Generación') || g('Codigo de Generacion'),
    selloRecepcion: g('Sello de Recepción') || g('Sello de Recepcion'),
    numeroControl: g('Número de Control') || g('Numero de Control'),
    montoTotal: g('Monto Total'),
    ivaOperaciones: g('IVA de las operaciones'),
    ivaPercibido: g('IVA percibido'),
    ivaRetenido: g('IVA retenido'),
    retencionRenta: g('Retención renta') || g('Retencion renta'),
    totalNoAfectos: g('Total valores no afectos'),
    totalPagarOperacion:
      g('Total a pagar/Total de operación') ||
      g('Total a pagar / Total de operación') ||
      g('Total de operación'),
    otrosTributos: g('Otros tributos'),
    documentoAjustado,
    ajustado,
  };
}

/* ===== Consulta UNA URL ===== */
export async function consultarConClick(page, url) {
  const u = new URL(url);
  const ambiente = u.searchParams.get('ambiente') || '';
  const codGen = u.searchParams.get('codGen') || '';
  const fechaEmi = u.searchParams.get('fechaEmi') || '';

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // click "Realizar Búsqueda"
    const tries = [
      async () => page.getByRole('button', { name: /Realizar Búsqueda/i }).click({ timeout: 2500 }),
      async () => page.click('text=Realizar Búsqueda', { timeout: 2500 }),
      async () => page.click('button:has-text("Realizar Búsqueda")', { timeout: 2500 }),
      async () => page.click('input[type="button"][value*="Realizar"]', { timeout: 2500 }),
    ];
    let clicked = false;
    for (const t of tries) { try { await t(); clicked = true; break; } catch {} }
    if (!clicked) {
      for (const f of page.frames()) {
        try { await f.click('text=Realizar Búsqueda', { timeout: 2000 }); clicked = true; break; } catch {}
      }
    }

    const { html } = await getResultadoScope(page);

    // Parseo principal
    const pares = paresDesdeHtml(html);
    const det = mapearDetalle(pares);

    // Fallback heurístico
    if (!det.estadoRaw || det.estado === 'DESCONOCIDO') {
      const bodyTxt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const m = bodyTxt.match(/Estado[^:]*:\s*([A-Za-zÁÉÍÓÚÑñ\s]+)/i);
      const linea = (m && m[1]) || '';
      const heur = normalizarEstado(linea || bodyTxt);
      if (heur !== 'DESCONOCIDO') { det.estado = heur; det.estadoRaw = linea; }
    }

    const observaciones = extraerObservaciones(html);
    const observacionesTexto = formatObservacionesTexto(observaciones);
    const relacionados = extraerDocumentosRelacionados(html);
    const relacionadosTexto = formatRelacionadosTexto(relacionados);

    return {
      ok: true,
      url,
      linkVisita: url,
      visitar: 'Abrir',
      //host,
      ambiente,
      codGen,
      fechaEmi,
      ...det,
      observaciones,
      observacionesTexto,
      relacionados,
      relacionadosTexto,
      error: ''
    };
  } catch (e) {
    return {
      ok: false,
       url,
      linkVisita: url,
      visitar: 'Abrir',
      //host,
      ambiente,
      codGen,
      fechaEmi,
      estado: 'ERROR',
      estadoRaw: '',
      tipoDte: '',
      tipoDteNorm: 'SIN_TIPO',
      observaciones: [],
      observacionesTexto: '',
      relacionados: [],
      relacionadosTexto: '',
      error: e?.message || String(e)
    };
  }
}

function extraerObservaciones(html) {
  const $ = cheerioLoad(html);
  const table = $('table').toArray().find(t => {
    const headers = tableHeadersFromCheerio($, t);
    return headers.join('|').includes('observacion');
  });
  if (!table) return [];

  const headers = tableHeadersFromCheerio($, table);
  const obsIdx = indexOfHeader(headers, 'observacion', 1);
  const rows = [];
  $(table).find('tbody tr').toArray().forEach((tr, i) => {
    const tds = $(tr).find('td').toArray();
    const get = idx => (idx >= 0 && tds[idx]) ? limpiar($(tds[idx]).text()) : '';
    const observacion = get(obsIdx);
    if (!observacion) return;
    let numero = get(0);
    if (!numero) numero = String(i + 1);
    rows.push({ numero, observacion });
  });
  return rows;
}

function extraerDocumentosRelacionados(html) {
  const $ = cheerioLoad(html);
  const table = $('table').toArray().find(t => {
    const headers = tableHeadersFromCheerio($, t);
    const joined = headers.join('|');
    return joined.includes('fecha de generacion')
      && joined.includes('codigo de generacion')
      && joined.includes('sello de recepcion');
  });
  if (!table) return [];

  const headers = tableHeadersFromCheerio($, table);
  const idxF = indexOfHeader(headers, 'fecha de generacion', 1);
  const idxC = indexOfHeader(headers, 'codigo de generacion', 2);
  const idxS = indexOfHeader(headers, 'sello de recepcion', 3);
  const idxT = indexOfTipoHeader(headers);
  const rows = [];
  $(table).find('tbody tr').toArray().forEach(tr => {
    const tds = $(tr).find('td').toArray();
    const get = i => (i >= 0 && tds[i]) ? limpiar($(tds[i]).text()) : '';
    const codigoGeneracion = get(idxC);
    if (!codigoGeneracion) return;
    rows.push({
      fechaGeneracion: get(idxF),
      codigoGeneracion,
      selloRecepcion: get(idxS),
      tipoDocumentacion: get(idxT),
    });
  });
  return rows;
}

function isNotaCreditoTipo(tipo) {
  const t = sinAcentos(limpiar(tipo)).toUpperCase();
  return t.includes('NOTA') && t.includes('CREDITO');
}

function pickNotaCredito(relacionados) {
  if (!Array.isArray(relacionados)) return null;
  const byTipo = relacionados.find(r => isNotaCreditoTipo(r.tipoDocumentacion) && r.codigoGeneracion);
  if (byTipo) return byTipo;
  return relacionados.find(r => r.codigoGeneracion) || null;
}

export function fechaEmiFromGeneracion(fecha) {
  const raw = limpiar(fecha).split(' ')[0].replace(/-/g, '/');
  const parts = raw.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
  }
  return raw;
}

function applyNotaCreditoFields(parent, nc, verified, verifyErr) {
  if (!parent || !nc) return;
  parent.tieneNotaCredito = true;
  parent.notaCreditoCodigoGeneracion = nc.codigoGeneracion;
  parent.notaCreditoSelloRecepcion = nc.selloRecepcion;
  parent.notaCreditoFechaGeneracion = nc.fechaGeneracion;
  parent.notaCreditoFechaEmi = fechaEmiFromGeneracion(nc.fechaGeneracion);
  parent.notaCreditoTipoDocumento = nc.tipoDocumentacion;

  if (verifyErr) {
    parent.notaCreditoError = verifyErr?.message || String(verifyErr);
    nc.error = parent.notaCreditoError;
    return;
  }

  parent.notaCreditoEstado = verified?.estado || '';
  parent.notaCreditoEstadoRaw = verified?.estadoRaw || '';
  parent.notaCreditoNumeroControl = verified?.numeroControl || '';
  parent.notaCreditoMontoTotal = verified?.montoTotal || '';
  parent.notaCreditoLinkVisita = verified?.linkVisita || verified?.url || '';
  nc.estado = parent.notaCreditoEstado;
  nc.estadoRaw = parent.notaCreditoEstadoRaw;
  nc.verificado = true;
}

async function enrichCreditNotesFromRelated(ctx, resultados, pagePool, concurrencia = 2) {
  const jobs = [];
  resultados.forEach((r, idx) => {
    if (r?.tieneNotaCredito) return;
    const nc = pickNotaCredito(r.relacionados);
    if (!nc) return;
    jobs.push({ idx, nc, ambiente: r.ambiente || '01' });
  });
  if (!jobs.length) return resultados;

  const pending = new Map();
  for (const job of jobs) {
    const fechaYmd = fechaEmiFromGeneracion(job.nc.fechaGeneracion);
    if (!fechaYmd) {
      applyNotaCreditoFields(resultados[job.idx], job.nc, null, new Error('no se pudo obtener fecha de emision de la nota de credito relacionada'));
      continue;
    }
    const url = buildQuery(ADMIN, {
      ambiente: job.ambiente,
      codGen: job.nc.codigoGeneracion,
      fechaEmi: fechaYmd,
    });
    const key = cacheKeyFromURL(url);
    const cached = getCachedScrape(url);
    if (cached) {
      applyNotaCreditoFields(resultados[job.idx], job.nc, cached, null);
      continue;
    }
    if (!pending.has(key)) pending.set(key, { url, callbacks: [] });
    const capturedIdx = job.idx;
    const capturedNC = job.nc;
    pending.get(key).callbacks.push((verified) => {
      applyNotaCreditoFields(resultados[capturedIdx], capturedNC, verified, null);
    });
  }

  const entries = Array.from(pending.values());
  if (!entries.length) return resultados;

  const ownPool = !pagePool;
  const pool = pagePool || await createPagePool(ctx, Math.min(concurrencia, entries.length));

  let cursor = 0;
  const worker = async () => {
    while (cursor < entries.length) {
      const entry = entries[cursor++];
      const page = await pool.acquire();
      try {
        await rateLimitScrape();
        const verified = await consultWithRetry(page, entry.url);
        for (const cb of entry.callbacks) cb(verified);
      } finally {
        pool.release(page);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrencia, entries.length) }, worker),
  );

  if (ownPool) await pool.close();
  return resultados;
}

/* ===== Pool por FILAS codGen/fecha ===== */
export async function procesarFilasConPool(ctx, filas, concurrencia = 2) {
  const cola = filas.slice();
  const hosts = [ADMIN, WEBAPP];
  const resultados = [];
  const pagePool = await createPagePool(ctx, Math.min(concurrencia, cola.length || 1));

  const tieneDetalle = (r) =>
    !!(r?.codigoGeneracion || r?.numeroControl || r?.selloRecepcion || r?.montoTotal);

  const worker = async () => {
    while (cola.length) {
      const { codGen, fechaYmd } = cola.shift();
      const page = await pagePool.acquire();
      try {
        await rateLimitScrape();
        let mejor = null;
        let candidatoEstado = null;
        for (const base of hosts) {
          const url = buildQuery(base, { ambiente: '01', codGen, fechaEmi: fechaYmd });
          const r = await consultWithRetry(page, url);
          const est = (r.estado || '').toUpperCase();

          if (r.ok && tieneDetalle(r)) { mejor = r; break; }
          if ((est === 'EMITIDO' || est === 'INVALIDADO') && !candidatoEstado) {
            candidatoEstado = r;
          }
        }

        resultados.push(mejor || candidatoEstado || {
          ok: false, url: '', linkVisita: '', visitar: 'Abrir',
          host: '', ambiente: '01', codGen, fechaEmi: fechaYmd,
          estado: 'NO ENCONTRADO', estadoRaw: '', tipoDte: '', tipoDteNorm: 'SIN_TIPO',
          relacionados: [], error: '',
        });
      } catch (err) {
        resultados.push({
          ok: false, url: '', linkVisita: '', visitar: 'Abrir',
          host: '', ambiente: '01', codGen, fechaEmi: fechaYmd,
          estado: 'ERROR', estadoRaw: '', tipoDte: '', tipoDteNorm: 'SIN_TIPO',
          relacionados: [], error: err?.message || String(err),
        });
      } finally {
        pagePool.release(page);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrencia, filas.length) }, worker),
  );

  await enrichCreditNotesFromRelated(ctx, resultados, pagePool, concurrencia);
  await pagePool.close();
  return resultados;
}

/* ========================= Excel helpers ========================= */
export const sheetNameSafe = (name) => {
  const bad = /[:\\/?*\[\]]/g;
  let s = (name || 'Hoja').replace(bad, ' ').trim();
  if (s.length > 31) s = s.slice(0, 31);
  return s || 'Hoja';
};

export function applyHyperlinks(ws) {
  const ref = ws['!ref']; if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const headers = {};
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c: C });
    const cell = ws[addr];
    if (cell && typeof cell.v === 'string') headers[cell.v] = C;
  }
  const colVisitar = headers['visitar'];
  const colLink = headers['linkVisita'];
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
    // Header profesional
    ['REPORTE DE VERIFICACIÓN DE DTEs', null, null],
    [null, null, null],
    ['Generado el', formattedDate, null],
    [null, null, null],
    // Resumen rápido
    ['Total de DTEs procesados', resultados.length, null],
    [null, null, null],
    // Tabla por tipo
    ['RESUMEN POR TIPO DE DOCUMENTO', null, null],
    ['Tipo de DTE', 'Cantidad', 'Porcentaje'],
    ...typeEntries.map(([type, count]) => [type, count, resultados.length > 0 ? ((count / resultados.length) * 100).toFixed(2) + '%' : '0%']),
    [null, null, null],
    // Tabla por estado
    ['RESUMEN POR ESTADO', null, null],
    ['Estado del Documento', 'Cantidad', 'Porcentaje'],
    ...statusEntries.map(([status, count]) => [status, count, resultados.length > 0 ? ((count / resultados.length) * 100).toFixed(2) + '%' : '0%']),
    [null, null, null],
    // Footer
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

      // Main title row
      if (R === 0) {
        ws[addr].s = headerStyleMain;
      }
      // Empty rows (separators)
      else if (value === null) {
        ws[addr].s = { fill: { fgColor: { rgb: 'FFFFFF' } } };
      }
      // Footer rows
      else if (R >= rows.length - 2) {
        ws[addr].s = footerStyle;
      }
      // Section headers
      else if (
        value === 'RESUMEN POR TIPO DE DOCUMENTO' ||
        value === 'RESUMEN POR ESTADO'
      ) {
        ws[addr].s = headerStyleDark;
        for (let CC = C; CC <= 2; ++CC) {
          const cellAddr = XLSX.utils.encode_cell({ r: R, c: CC });
          if (ws[cellAddr]) ws[cellAddr].s = headerStyleDark;
        }
      }
      // Column headers in sections
      else if (
        (value === 'Tipo de DTE' && ws[XLSX.utils.encode_cell({ r: R, c: C + 1 })]?.v === 'Cantidad') ||
        (value === 'Estado del Documento' && ws[XLSX.utils.encode_cell({ r: R, c: C + 1 })]?.v === 'Cantidad')
      ) {
        for (let CC = 0; CC <= 2; ++CC) {
          const cellAddr = XLSX.utils.encode_cell({ r: R, c: CC });
          if (ws[cellAddr]) ws[cellAddr].s = headerStyleMedium;
        }
      }
      // Info rows (Generado el, Total)
      else if (value === 'Generado el' || value === 'Total de DTEs procesados') {
        ws[addr].s = infoStyle;
        const valueAddr = XLSX.utils.encode_cell({ r: R, c: 1 });
        if (ws[valueAddr]) ws[valueAddr].s = infoStyle;
      }
      // Data cells
      else if (typeof value === 'number' || (typeof value === 'string' && value.includes('%'))) {
        ws[addr].s = { ...dataStyle, alignment: { horizontal: 'right', vertical: 'center' } };
      } else if (C === 0 && value) {
        ws[addr].s = { ...dataStyle, alignment: { horizontal: 'left', vertical: 'center' } };
      } else if (value) {
        ws[addr].s = dataStyle;
      }

      // Format numbers
      if (typeof ws[addr]?.v === 'number') {
        ws[addr].z = '0';
      }
    }
  }

  return ws;
}

export function buildWorkbook(resultados, options = {}) {
  const wb = XLSX.utils.book_new();

  const wsAll = XLSX.utils.json_to_sheet(resultados);
  applyHyperlinks(wsAll);
  prepareReportSheet(wsAll);
  XLSX.utils.book_append_sheet(wb, buildReportSummarySheet(resultados, wsAll, options), sheetNameSafe('Resumen'));
  XLSX.utils.book_append_sheet(wb, wsAll, sheetNameSafe('Todos'));

  const tipos = ['FACTURA', 'COMPROBANTE DE CRÉDITO FISCAL', 'NOTA DE CRÉDITO'];
  for (const t of tipos) {
    const rows = resultados.filter(r => r?.tipoDteNorm === t);
    const ws = XLSX.utils.json_to_sheet(rows);
    applyHyperlinks(ws);
    prepareReportSheet(ws);
    XLSX.utils.book_append_sheet(wb, ws, sheetNameSafe(t));
  }

  const rechaz = resultados.filter(r => r?.estado === 'RECHAZADO' || r?.estado === 'INVALIDADO');
  const wsR = XLSX.utils.json_to_sheet(rechaz);
  applyHyperlinks(wsR);
  prepareReportSheet(wsR);
  XLSX.utils.book_append_sheet(wb, wsR, sheetNameSafe('Rechazados'));

  const relAll = [];
  for (const r of resultados) {
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
          visitar: 'Abrir'
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

/* Exporto XLSX por si lo quieres usar desde los routes */
export { XLSX };
