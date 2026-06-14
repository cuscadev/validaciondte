// app/prrocesardte/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { auth } from '@/lib/firebase';

type Item = { numItem: number; codGen: string; fechaEmi: string };

type Resultado = {
  estado: string;
  tipoDte?: string;
  tipoDteNorm?: string;
  descripcionEstado?: string;
  linkVisita?: string;
  codigoGeneracion?: string;
  numeroControl?: string;
  tieneNotaCredito?: boolean;
  notaCreditoCodigoGeneracion?: string;
  notaCreditoEstado?: string;
  notaCreditoLinkVisita?: string;
  error?: string;
};

type ProcesarPayload = {
  error?: string;
  resultados?: Resultado[];
  downloadUrl?: string;
  filename?: string;
  excelBase64?: string;
};

const FECHA_REGEX = /^\d{2}\/\d{2}\/\d{4}$/; // dd/mm/yyyy
const UUID_HEX_REGEX =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
const MAX_ITEMS = 10;

/* ================= Helpers UI ================= */
function formatFechaInput(raw: string) {
  // deja solo dígitos y coloca / en 2 y 4
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  let out = dd;
  if (mm) out += `/${mm}`;
  if (yyyy) out += `/${yyyy}`;
  return out;
}

function estadoBadgeClasses(estado?: string) {
  const e = (estado || '').toUpperCase();
  if (e.includes('EMITIDO'))
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (e.includes('RECHAZ'))
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (e.includes('ANULAD'))
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
  if (e.includes('INVALID'))
    return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
  if (e.includes('NO ENCONTRADO'))
    return 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  if (e.includes('ERROR'))
    return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
  return 'bg-muted text-muted-foreground';
}

/* ============ Helpers para pegado Excel/CSV (clipboard) ============ */
function toDMY(fecha: string) {
  const t = (fecha || '').trim().replace(/-/g, '/');
  const dmY = /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/;
  if (!dmY.test(t)) return '';
  const [dd, mm, yyyy] = t.replace(/-/g, '/').split('/');
  return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
}
function guessSeparator(line: string): string | RegExp {
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  if (line.includes(',')) return ',';
  return /\s{2,}/; // 2+ espacios
}
function parsePastedItems(texto: string): Array<{ codGen: string; fechaEmi: string }> {
  const out: Array<{ codGen: string; fechaEmi: string }> = [];
  const lines = (texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (/c[oó]d/i.test(line) && /fecha/i.test(line)) continue; // posible header
    const sep = guessSeparator(line);
    const cells = typeof sep === 'string' ? line.split(sep) : line.split(sep);
    if (!cells.length) continue;

    let codGen = '';
    let fechaEmi = '';

    for (const cRaw of cells) {
      const c = cRaw.trim();
      if (!codGen && UUID_HEX_REGEX.test(c)) codGen = c;
      if (!fechaEmi && /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(c)) fechaEmi = toDMY(c);
    }

    if ((!codGen || !fechaEmi) && cells.length >= 2) {
      const a = (cells[0] || '').trim();
      const b = (cells[1] || '').trim();
      if (!codGen && UUID_HEX_REGEX.test(a)) codGen = a;
      if (!codGen && UUID_HEX_REGEX.test(b)) codGen = b;
      if (!fechaEmi && /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(a)) fechaEmi = toDMY(a);
      if (!fechaEmi && /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(b)) fechaEmi = toDMY(b);
    }

    if (codGen && fechaEmi) out.push({ codGen, fechaEmi });
    if (out.length >= MAX_ITEMS) break;
  }
  return out.slice(0, MAX_ITEMS);
}

function downloadBase64File(base64: string, filename: string) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ======================= Página ======================= */
export default function Page() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Item[]>([{ numItem: 1, codGen: '', fechaEmi: '' }]);
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<Record<number, Resultado>>({});
  const [ambiente, setAmbiente] = useState<'00' | '01'>('01');
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [excelInfo, setExcelInfo] = useState<{ url?: string; base64?: string; name?: string } | null>(null);

  const puedeAgregar = useMemo(() => items.length < MAX_ITEMS, [items.length]);

  const agregarItem = () =>
    setItems(prev => (prev.length < MAX_ITEMS ? [...prev, { numItem: prev.length + 1, codGen: '', fechaEmi: '' }] : prev));

  const eliminarItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, numItem: i + 1 })));
    setResultados(prev => {
      const n: Record<number, Resultado> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (i < idx) n[i] = v;
        else if (i > idx) n[i - 1] = v;
      });
      return n;
    });
  };

  const updateItem = (idx: number, field: keyof Item, value: string) =>
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

  const limpiarResultados = () => {
    setResultados({});
    setErrorGlobal(null);
    setExcelInfo(null);
  };

  /* ====== PEGAR DESDE PORTAPAPELES (como estaba) ====== */
  const pegarDesdePortapapeles = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        const msg = t('prrocesardte_clipboard_empty');
        setErrorGlobal(msg);
        toast.error(msg);
        return;
      }
      const parsed = parsePastedItems(text);
      if (!parsed.length) {
        const msg = t('prrocesardte_clipboard_invalid');
        setErrorGlobal(msg);
        toast.error(msg);
        return;
      }
      const actuales = items.filter(it => it.codGen || it.fechaEmi);
      const capacidad = MAX_ITEMS - actuales.length;
      const aInsertar = parsed.slice(0, capacidad);

      const nuevos: Item[] = [...actuales];
      for (const p of aInsertar) {
        nuevos.push({ numItem: nuevos.length + 1, codGen: p.codGen, fechaEmi: p.fechaEmi });
      }
      setItems(nuevos.length ? nuevos : [{ numItem: 1, codGen: '', fechaEmi: '' }]);
      setResultados({});
      setExcelInfo(null);
      setErrorGlobal(null);
    } catch {
      const msg = t('prrocesardte_clipboard_error');
      setErrorGlobal(msg);
      toast.error(msg);
    }
  };

  const validar = async () => {
    setErrorGlobal(null);
    setResultados({});
    setExcelInfo(null);

    if (!items.length) {
      const msg = t('prrocesardte_error_no_items');
      setErrorGlobal(msg);
      toast.error(msg);
      return;
    }
    if (items.length > MAX_ITEMS) {
      const msg = t('prrocesardte_error_max_items', { max: MAX_ITEMS });
      setErrorGlobal(msg);
      toast.error(msg);
      return;
    }
    for (const it of items) {
      if (!it.codGen?.trim() || !it.fechaEmi?.trim()) {
        const msg = t('prrocesardte_error_missing_fields');
        setErrorGlobal(msg);
        toast.error(msg);
        return;
      }
      if (!FECHA_REGEX.test(it.fechaEmi.trim())) {
        const msg = t('prrocesardte_error_fecha');
        setErrorGlobal(msg);
        toast.error(msg);
        return;
      }
      if (!UUID_HEX_REGEX.test(it.codGen.trim())) {
        const msg = t('prrocesardte_error_codigo', { code: it.codGen });
        setErrorGlobal(msg);
        toast.error(msg);
        return;
      }
    }

    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/procesaedte', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          routeKey: 'verificacion_individual',
          items: items.map(it => ({ codGen: it.codGen.trim(), fecha: it.fechaEmi.trim() })),
          concurrencia: 8,
          ambiente,
          includeExcel: true, // Pedir Excel al backend
          enrichCreditNotes: true,
        }),
      });

      const payload = await res.json() as ProcesarPayload;
      if (!res.ok) throw new Error(payload?.error || res.statusText);

      const map: Record<number, Resultado> = {};
      payload.resultados?.forEach((r, i) => {
        map[i] = {
          estado: r?.estado || 'DESCONOCIDO',
          tipoDte: r?.tipoDte,
          tipoDteNorm: r?.tipoDteNorm,
          descripcionEstado: r?.descripcionEstado,
          linkVisita: r?.linkVisita,
          codigoGeneracion: r?.codigoGeneracion,
          numeroControl: r?.numeroControl,
          tieneNotaCredito: r?.tieneNotaCredito,
          notaCreditoCodigoGeneracion: r?.notaCreditoCodigoGeneracion,
          notaCreditoEstado: r?.notaCreditoEstado,
          notaCreditoLinkVisita: r?.notaCreditoLinkVisita,
          error: r?.error,
        };
      });
      setResultados(map);

      // Excel listo para descargar
      if (payload.downloadUrl) {
        setExcelInfo({ url: payload.downloadUrl, name: payload.filename || 'resultados_dtes.xlsx' });
      } else if (payload.excelBase64) {
        setExcelInfo({ base64: payload.excelBase64, name: payload.filename || 'resultados_dtes.xlsx' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('prrocesardte_error_unexpected');
      setErrorGlobal(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const exportarExcel = () => {
    if (!excelInfo) return;
    if (excelInfo.url) {
      const a = document.createElement('a');
      a.href = excelInfo.url;
      a.download = excelInfo.name || 'resultados_dtes.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else if (excelInfo.base64) {
      downloadBase64File(excelInfo.base64, excelInfo.name || 'resultados_dtes.xlsx');
    }
  };

  return (
    <main className=" w-full max-w-full w-full max-w-[1600px] mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-900 dark:text-gray-100">
        {t('prrocesardte_title')}
      </h1>

      {/* Entrada */}
      <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t('prrocesardte_detalle', { count: items.length, max: MAX_ITEMS })}
          </h2>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 dark:text-gray-300">{t('prrocesardte_ambiente')}</label>
            <select
              value={ambiente}
              onChange={(e) => setAmbiente(e.target.value === '00' ? '00' : '01')}
              className="bg-transparent border rounded px-2 py-1 text-sm dark:border-gray-700"
              title="01 = Producción, 00 = Pruebas"
            >
              <option value="01">01 ({t('prrocesardte_produccion')})</option>
              <option value="00">00 ({t('prrocesardte_pruebas')})</option>
            </select>

            <button
              type="button"
              onClick={agregarItem}
              disabled={!puedeAgregar}
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {t('prrocesardte_agregar')}
            </button>

            {/* Mantener el botón de pegar desde portapapeles tal cual */}
            <button
              type="button"
              onClick={pegarDesdePortapapeles}
              className="bg-sky-600 text-white py-2 px-4 rounded hover:bg-sky-700"
              title="Pega filas copiadas desde Excel: UUID y fecha dd/mm/yyyy"
            >
              {t('prrocesardte_pegar')}
            </button>

            <button
              type="button"
              onClick={limpiarResultados}
              className="rounded bg-muted px-4 py-2 text-foreground transition hover:bg-muted/80"
            >
              {t('prrocesardte_limpiar')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border text-sm border-gray-200 dark:border-gray-700">
            <thead className="bg-blue-600 text-white dark:bg-blue-700">
              <tr>
                <th className="border px-4 py-2 border-blue-700/40">{t('prrocesardte_item')}</th>
                <th className="border px-4 py-2 border-blue-700/40">{t('prrocesardte_codigo')}</th>
                <th className="border px-4 py-2 border-blue-700/40 text-center">{t('prrocesardte_fecha')}</th>
                <th className="border px-4 py-2 border-blue-700/40">{t('prrocesardte_acciones')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="bg-card">
                  <td className="border px-2 py-1 border-gray-200 dark:border-gray-700">
                    <input
                      type="text"
                      value={it.numItem}
                      readOnly
                      className=" text-center w-full bg-gray-100 dark:bg-gray-700 text-sm px-2 py-1 rounded focus:outline-none text-gray-900 dark:text-gray-100"
                    />
                  </td>
                  <td className="border px-2 py-1 border-gray-200 dark:border-gray-700">
                    <input
                      type="text"
                      value={it.codGen}
                      onChange={(e) => updateItem(idx, 'codGen', e.target.value)}
                      placeholder={t('prrocesardte_codigo_placeholder')}
                      className="text-center w-full bg-transparent text-sm px-2 py-1 focus:outline-none text-gray-900 dark:text-gray-100"
                    />
                  </td>
                  <td className="border px-2 py-1 border-gray-200 dark:border-gray-700 text-center">
                    <input
                      type="text"
                      value={it.fechaEmi}
                      onChange={(e) => updateItem(idx, 'fechaEmi', formatFechaInput(e.target.value))}
                      placeholder={t('prrocesardte_fecha_placeholder')}
                      inputMode="numeric"
                      className=" text-center w-full bg-transparent text-sm px-2 py-1 focus:outline-none text-gray-900 dark:text-gray-100"
                    />
                  </td>
                  <td className="border px-2 py-1 text-center border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => eliminarItem(idx)}
                      className="text-red-600 hover:underline"
                    >
                      {t('prrocesardte_eliminar')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={validar}
            disabled={loading || items.length === 0}
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? t('prrocesardte_validando') : t('prrocesardte_validar')}
          </button>

          <button
            type="button"
            onClick={exportarExcel}
            disabled={loading || !excelInfo}
            className="bg-emerald-600 text-white py-2 px-4 rounded hover:bg-emerald-700 disabled:opacity-60"
          >
            {t('prrocesardte_exportar')}
          </button>

          {errorGlobal && <span className="text-red-600 dark:text-red-400">{errorGlobal}</span>}
        </div>
      </section>

      {/* Resultados */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow">
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">{t('prrocesardte_resultados')}</h2>
        <div className="overflow-x-auto">
          <table className="text-center min-w-full table-auto border text-sm border-gray-200 dark:border-gray-700">
            <thead className="text-center bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100">
              <tr>
                <th className="text-center border px-3 py-2 border-gray-200 dark:border-gray-700">{t('prrocesardte_item')}</th>
                <th className="text-center border px-3 py-2 border-gray-200 dark:border-gray-700">{t('prrocesardte_estado')}</th>
                <th className="text-center border px-3 py-2 border-gray-200 dark:border-gray-700">{t('prrocesardte_tipo')}</th>
                <th className="text-center border px-3 py-2 border-gray-200 dark:border-gray-700">{t('prrocesardte_descripcion')}</th>
                <th className="text-center border px-3 py-2 border-gray-200 dark:border-gray-700">{t('prrocesardte_codigo')}</th>
                <th className="text-center border px-3 py-2 border-gray-200 dark:border-gray-700">{t('prrocesardte_control')}</th>
                <th className="text-center border px-3 py-2 border-gray-200 dark:border-gray-700">Tiene NC</th>
                <th className="text-center border px-3 py-2 border-gray-200 dark:border-gray-700">Codigo NC</th>
                <th className="text-center border px-3 py-2 border-gray-200 dark:border-gray-700">Estado NC</th>
                <th className="text-center border px-3 py-2 border-gray-200 dark:border-gray-700">Abrir NC</th>
                <th className="text-center border px-3 py-2 border-gray-200 dark:border-gray-700">{t('prrocesardte_abrir')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const r = resultados[idx];
                return (
                  <tr key={idx} className="bg-card">
                    <td className="text-center border px-2 py-1 border-gray-200 dark:border-gray-700">{it.numItem}</td>
                    <td className="text-center border px-2 py-1 border-gray-200 dark:border-gray-700">
                      {r ? (
                        <>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${estadoBadgeClasses(
                              r.estado
                            )}`}
                          >
                            {r.estado}
                          </span>
                          {r?.error && (
                            <div className="text-xs mt-1 text-rose-600 dark:text-rose-400">
                              {r.error}
                            </div>
                          )}
                        </>
                      ) : loading ? (
                        'Consultando…'
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="border px-2 py-1 border-gray-200 dark:border-gray-700">
                      {r?.tipoDte || r?.tipoDteNorm || '-'}
                    </td>
                    <td className="border px-2 py-1 border-gray-200 dark:border-gray-700">
                      {r?.descripcionEstado || '-'}
                    </td>
                    <td className="border px-2 py-1 border-gray-200 dark:border-gray-700">
                      {r?.codigoGeneracion || '-'}
                    </td>
                    <td className="border px-2 py-1 border-gray-200 dark:border-gray-700">
                      {r?.numeroControl || '-'}
                    </td>
                    <td className="border px-2 py-1 border-gray-200 dark:border-gray-700">
                      {r?.tieneNotaCredito === true ? 'Si' : r?.tieneNotaCredito === false ? 'No' : '-'}
                    </td>
                    <td className="border px-2 py-1 border-gray-200 dark:border-gray-700">
                      {r?.notaCreditoCodigoGeneracion || '-'}
                    </td>
                    <td className="border px-2 py-1 border-gray-200 dark:border-gray-700">
                      {r?.notaCreditoEstado || '-'}
                    </td>
                    <td className="border px-2 py-1 text-center border-gray-200 dark:border-gray-700">
                      {r?.notaCreditoLinkVisita ? (
                        <a
                          href={r.notaCreditoLinkVisita}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 underline"
                        >
                          Abrir NC
                        </a>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td className="border px-2 py-1 text-center border-gray-200 dark:border-gray-700">
                      {r?.linkVisita ? (
                        <a
                          href={r.linkVisita}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 underline"
                        >
                          {t('prrocesardte_abrir')}
                        </a>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
