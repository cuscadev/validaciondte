// app/prrocesardte/page.tsx
'use client';

import PlanGate from '@/components/PlanGate';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast, Toaster } from 'sonner';

type Item = { numItem: number; codGen: string; fechaEmi: string };

type Resultado = {
  estado: string;
  tipoDte?: string;
  tipoDteNorm?: string;
  descripcionEstado?: string;
  linkVisita?: string;
  codigoGeneracion?: string;
  numeroControl?: string;
  error?: string;
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
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (e.includes('INVALID'))
    return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
  if (e.includes('NO ENCONTRADO'))
    return 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  if (e.includes('ERROR'))
    return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
  return 'bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200';
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
    if (idx === 0) return;
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
    } catch (e: any) {
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
      const res = await fetch('/api/procesaedte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items: items.map(it => ({ codGen: it.codGen.trim(), fecha: it.fechaEmi.trim() })),
          concurrencia: 2,
          ambiente,
          includeExcel: true, // Pedir Excel al backend
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || res.statusText);

      const map: Record<number, Resultado> = {};
      (payload.resultados as any[])?.forEach((r: any, i: number) => {
        map[i] = {
          estado: r?.estado || 'DESCONOCIDO',
          tipoDte: r?.tipoDte,
          tipoDteNorm: r?.tipoDteNorm,
          descripcionEstado: r?.descripcionEstado,
          linkVisita: r?.linkVisita,
          codigoGeneracion: r?.codigoGeneracion,
          numeroControl: r?.numeroControl,
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
    } catch (e: any) {
      const msg = e?.message || t('prrocesardte_error_unexpected');
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
    <PlanGate routeKey="verificacion_individual">
    <main className="w-full max-w-full">
      <Toaster position="top-right" richColors />
      <header className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-600 dark:text-yellow-300">
          Consulta individual
        </p>
        <h1 className="text-3xl font-bold text-slate-950 dark:text-white">
          {t('prrocesardte_title')}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
          Ingresa hasta {MAX_ITEMS} documentos con código de generación y fecha de emisión para consultar su estado en Hacienda.
        </p>
      </header>

      {/* Entrada */}
      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">
            {t('prrocesardte_detalle', { count: items.length, max: MAX_ITEMS })}
          </h2>

          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">{t('prrocesardte_ambiente')}</label>
            <select
              value={ambiente}
              onChange={(e) => setAmbiente(e.target.value === '00' ? '00' : '01')}
              className="rounded border border-slate-200 bg-background px-2 py-1 text-sm dark:border-white/10"
              title="01 = Producción, 00 = Pruebas"
            >
              <option value="01">01 ({t('prrocesardte_produccion')})</option>
              <option value="00">00 ({t('prrocesardte_pruebas')})</option>
            </select>

            <button
              type="button"
              onClick={agregarItem}
              disabled={!puedeAgregar}
              className="rounded bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-300 disabled:opacity-50"
            >
              {t('prrocesardte_agregar')}
            </button>

            {/* Mantener el botón de pegar desde portapapeles tal cual */}
            <button
              type="button"
              onClick={pegarDesdePortapapeles}
              className="rounded bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              title="Pega filas copiadas desde Excel: UUID y fecha dd/mm/yyyy"
            >
              {t('prrocesardte_pegar')}
            </button>

            <button
              type="button"
              onClick={limpiarResultados}
              className="rounded bg-slate-200 px-4 py-2 text-slate-800 hover:bg-slate-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              {t('prrocesardte_limpiar')}
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 shadow-sm dark:border-white/10 dark:bg-black dark:text-white">
          <h3 className="font-semibold text-amber-600 dark:text-yellow-300">Indicaciones para completar la tabla</h3>
          <p className="mt-1 text-slate-600 dark:text-zinc-300">
            Usa formato UUID para el código y fecha dd/mm/yyyy. Puedes pegar filas copiadas desde Excel; se tomarán hasta {MAX_ITEMS} documentos.
          </p>
        </div>

        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-white/10">
          <table className="min-w-full table-auto text-sm">
            <thead className="bg-slate-100 text-slate-950 dark:bg-zinc-900 dark:text-zinc-100">
              <tr>
                <th className="border border-slate-200 px-4 py-2 dark:border-white/10">{t('prrocesardte_item')}</th>
                <th className="border border-slate-200 px-4 py-2 dark:border-white/10">{t('prrocesardte_codigo')}</th>
                <th className="border border-slate-200 px-4 py-2 text-center dark:border-white/10">{t('prrocesardte_fecha')}</th>
                <th className="border border-slate-200 px-4 py-2 dark:border-white/10">{t('prrocesardte_acciones')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="bg-white hover:bg-slate-50 dark:bg-zinc-950 dark:hover:bg-black">
                  <td className="border border-slate-200 px-2 py-1 dark:border-white/10">
                    <input
                      type="text"
                      value={it.numItem}
                      readOnly
                      className="w-full rounded bg-slate-100 px-2 py-1 text-center text-sm text-slate-950 focus:outline-none dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </td>
                  <td className="border border-slate-200 px-2 py-1 dark:border-white/10">
                    <input
                      type="text"
                      value={it.codGen}
                      onChange={(e) => updateItem(idx, 'codGen', e.target.value)}
                      placeholder={t('prrocesardte_codigo_placeholder')}
                      className="w-full bg-transparent px-2 py-1 text-center text-sm text-foreground focus:outline-none"
                    />
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center dark:border-white/10">
                    <input
                      type="text"
                      value={it.fechaEmi}
                      onChange={(e) => updateItem(idx, 'fechaEmi', formatFechaInput(e.target.value))}
                      placeholder={t('prrocesardte_fecha_placeholder')}
                      inputMode="numeric"
                      className="w-full bg-transparent px-2 py-1 text-center text-sm text-foreground focus:outline-none"
                    />
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => eliminarItem(idx)}
                      disabled={idx === 0}
                      title={idx === 0 ? 'La primera fila no se puede eliminar' : undefined}
                      className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:text-red-400 dark:disabled:text-zinc-600"
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
            className="rounded bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-300 disabled:opacity-60"
          >
            {loading ? t('prrocesardte_validando') : t('prrocesardte_validar')}
          </button>

          <button
            type="button"
            onClick={exportarExcel}
            disabled={loading || !excelInfo}
            className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {t('prrocesardte_exportar')}
          </button>

          {errorGlobal && <span className="text-red-600 dark:text-red-400">{errorGlobal}</span>}
        </div>
      </section>

      {/* Resultados */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-bold text-slate-950 dark:text-white">{t('prrocesardte_resultados')}</h2>
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 shadow-sm dark:border-white/10 dark:bg-black dark:text-white">
          <h3 className="font-semibold text-amber-600 dark:text-yellow-300">Indicaciones para revisar resultados</h3>
          <p className="mt-1 text-slate-600 dark:text-zinc-300">
            Después de validar, revisa el estado, descripción y número de control. Usa Abrir para ir al comprobante oficial cuando el enlace esté disponible.
          </p>
        </div>
        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-white/10">
          <table className="min-w-full table-auto text-center text-sm">
            <thead className="bg-slate-100 text-center text-slate-950 dark:bg-zinc-900 dark:text-zinc-100">
              <tr>
                <th className="border border-slate-200 px-3 py-2 text-center dark:border-white/10">{t('prrocesardte_item')}</th>
                <th className="border border-slate-200 px-3 py-2 text-center dark:border-white/10">{t('prrocesardte_estado')}</th>
                <th className="border border-slate-200 px-3 py-2 text-center dark:border-white/10">{t('prrocesardte_tipo')}</th>
                <th className="border border-slate-200 px-3 py-2 text-center dark:border-white/10">{t('prrocesardte_descripcion')}</th>
                <th className="border border-slate-200 px-3 py-2 text-center dark:border-white/10">{t('prrocesardte_codigo')}</th>
                <th className="border border-slate-200 px-3 py-2 text-center dark:border-white/10">{t('prrocesardte_control')}</th>
                <th className="border border-slate-200 px-3 py-2 text-center dark:border-white/10">{t('prrocesardte_abrir')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const r = resultados[idx];
                return (
                  <tr key={idx} className="bg-white hover:bg-slate-50 dark:bg-zinc-950 dark:hover:bg-black">
                    <td className="border border-slate-200 px-2 py-1 text-center dark:border-white/10">{it.numItem}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center dark:border-white/10">
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
                    <td className="border border-slate-200 px-2 py-1 dark:border-white/10">
                      {r?.tipoDte || r?.tipoDteNorm || '-'}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 dark:border-white/10">
                      {r?.descripcionEstado || '-'}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 dark:border-white/10">
                      {r?.codigoGeneracion || '-'}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 dark:border-white/10">
                      {r?.numeroControl || '-'}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center dark:border-white/10">
                      {r?.linkVisita ? (
                        <a
                          href={r.linkVisita}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-600 underline dark:text-yellow-300"
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
    </PlanGate>
  );
}
