'use client';

import PlanGate from '@/components/PlanGate';
import FechaEmiInput from '@/components/dte/FechaEmiInput';
import UploadResultsReveal from '@/components/upload/UploadResultsReveal';
import UploadTableToolbar from '@/components/upload/UploadTableToolbar';
import UploadTableBasicFilters, { countBasicFilters } from '@/components/upload/UploadTableBasicFilters';
import UploadTableHints from '@/components/upload/UploadTableHints';
import { useUploadResultsReveal } from '@/components/upload/useUploadResultsReveal';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FECHA_DMY_REGEX } from '@/lib/dte-fecha-input';
import { parsePastedItems, UUID_REGEX } from '@/lib/dte-individual-paste';
import {
  DTE_RESULT_COLUMNS,
  type DteResultRow,
  dteResultSearchFields,
  isDteResultLongTextColumn,
  renderDteResultCell,
} from '@/lib/dte-result-table';
import {
  buildExportFilename,
  exportPdfByProfile,
  exportRowsToCsv,
} from '@/lib/upload-table-export';
import { recordProcessingLog } from '@/lib/client-processing-log';
import { DEFAULT_CONCURRENCY, pollDteJob } from '@/lib/go-dte-api';
import { summarizeResults } from '@/lib/processing-log';
import { Switch } from '@/components/ui/switch';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardPaste,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { consumeVerifyBatch } from '@/lib/gmail/verification-bridge';
import { toast } from 'sonner';

type Item = { numItem: number; codGen: string; fechaEmi: string };

const MAX_ITEMS = 10;

export default function Page() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Item[]>([{ numItem: 1, codGen: '', fechaEmi: '' }]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DteResultRow[]>([]);
  const [ambiente, setAmbiente] = useState<'00' | '01'>('01');
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [downloadHref, setDownloadHref] = useState<string | null>(null);
  const [filename, setFilename] = useState('resultados_dtes.xlsx');
  const [search, setSearch] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [enrichCreditNotes, setEnrichCreditNotes] = useState(true);
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const { resultsVisible, resetResultsVisibility, onResultsReveal } = useUploadResultsReveal();

  useEffect(() => {
    const batch = consumeVerifyBatch();
    if (!batch.length) return;
    setItems(
      batch.slice(0, MAX_ITEMS).map((row, index) => ({
        numItem: index + 1,
        codGen: row.codGen,
        fechaEmi: row.fechaEmi,
      }))
    );
    toast.success(`Se cargaron ${Math.min(batch.length, MAX_ITEMS)} DTE desde Gmail.`);
  }, []);

  const puedeAgregar = items.length < MAX_ITEMS;

  const agregarItem = () =>
    setItems((prev) =>
      prev.length < MAX_ITEMS
        ? [...prev, { numItem: prev.length + 1, codGen: '', fechaEmi: '' }]
        : prev
    );

  const eliminarItem = (idx: number) => {
    if (idx === 0) return;
    setItems((prev) =>
      prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, numItem: i + 1 }))
    );
  };

  const updateItem = (idx: number, field: keyof Item, value: string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

  const pegarDesdePortapapeles = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        const msg = t('prrocesardte_clipboard_empty');
        setErrorGlobal(msg);
        toast.error(msg);
        return;
      }
      const parsed = parsePastedItems(text, MAX_ITEMS);
      if (!parsed.length) {
        const msg = t('prrocesardte_clipboard_invalid');
        setErrorGlobal(msg);
        toast.error(msg);
        return;
      }
      const actuales = items.filter((it) => it.codGen || it.fechaEmi);
      const capacidad = MAX_ITEMS - actuales.length;
      const aInsertar = parsed.slice(0, capacidad);

      const nuevos: Item[] = [...actuales];
      for (const p of aInsertar) {
        nuevos.push({ numItem: nuevos.length + 1, codGen: p.codGen, fechaEmi: p.fechaEmi });
      }
      setItems(nuevos.length ? nuevos : [{ numItem: 1, codGen: '', fechaEmi: '' }]);
      setErrorGlobal(null);
      toast.success(t('prrocesardte_pegar_ok', { count: aInsertar.length }));
    } catch {
      const msg = t('prrocesardte_clipboard_error');
      setErrorGlobal(msg);
      toast.error(msg);
    }
  };

  const validar = async () => {
    setErrorGlobal(null);
    resetResultsVisibility();
    setData([]);
    setDownloadHref(null);
    setCurrentPage(1);

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
      if (!FECHA_DMY_REGEX.test(it.fechaEmi.trim())) {
        const msg = t('prrocesardte_error_fecha');
        setErrorGlobal(msg);
        toast.error(msg);
        return;
      }
      if (!UUID_REGEX.test(it.codGen.trim())) {
        const msg = t('prrocesardte_error_codigo', { code: it.codGen });
        setErrorGlobal(msg);
        toast.error(msg);
        return;
      }
    }

    setLoading(true);
    setProgressDone(0);
    setProgressTotal(items.length);
    const startedAt = new Date();
    const started = performance.now();
    const emptyFiles = { count: 0, totalBytes: 0, extensions: [], mimeTypes: [] };

    try {
      const res = await fetch('/api/procesaedte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items: items.map((it) => ({ codGen: it.codGen.trim(), fecha: it.fechaEmi.trim() })),
          concurrencia: DEFAULT_CONCURRENCY,
          ambiente,
          includeExcel: true,
          enrichCreditNotes,
          async: items.length > 10,
        }),
      });

      let payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || res.statusText);

      if (payload.jobId && payload.status === 'pending') {
        payload = await pollDteJob(payload.jobId, (status) => {
          setProgressDone(status.done ?? 0);
          setProgressTotal(status.total ?? items.length);
        });
      }

      const resultados = (payload.resultados as DteResultRow[]) || [];
      setData(resultados);
      setFilename(payload.filename || 'resultados_dtes.xlsx');
      setDownloadHref(
        payload.downloadUrl ||
          (payload.excelBase64
            ? `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${payload.excelBase64}`
            : null)
      );
      onResultsReveal();
      toast.success(t('prrocesardte_validar_ok'));
      await recordProcessingLog({
        routeKey: 'verificacion_individual',
        moduleName: 'Verificacion Individual',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: emptyFiles,
        ...summarizeResults(resultados),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('prrocesardte_error_unexpected');
      setErrorGlobal(msg);
      toast.error(msg);
      await recordProcessingLog({
        routeKey: 'verificacion_individual',
        moduleName: 'Verificacion Individual',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: emptyFiles,
        totalRecords: items.length,
        successCount: 0,
        errorCount: items.length,
        statusBreakdown: { ERROR: items.length },
        outcome: 'error',
        errorMessage: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) =>
      dteResultSearchFields(r).some((v) => v.toLowerCase().includes(q))
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filtered.length, rowsPerPage, totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage, rowsPerPage]);

  const iconButton = (
    label: string,
    onClick: () => void,
    icon: ReactNode,
    disabled?: boolean
  ) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <PlanGate routeKey="verificacion_individual">
      <main className="w-full max-w-full space-y-6 dark:bg-background">
        <section className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <h2 className="text-sm font-semibold text-foreground">
              {t('prrocesardte_detalle', { count: items.length, max: MAX_ITEMS })}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                {t('prrocesardte_ambiente')}
                <select
                  value={ambiente}
                  onChange={(e) => setAmbiente(e.target.value === '00' ? '00' : '01')}
                  className="rounded-md border border-slate-200 bg-background px-2 py-1 text-sm dark:border-white/10"
                  title="01 = Producción, 00 = Pruebas"
                >
                  <option value="01">01 ({t('prrocesardte_produccion')})</option>
                  <option value="00">00 ({t('prrocesardte_pruebas')})</option>
                </select>
              </label>
              {iconButton(
                t('prrocesardte_tooltip_agregar'),
                agregarItem,
                <Plus className="size-4" />,
                !puedeAgregar
              )}
              {iconButton(
                t('prrocesardte_tooltip_pegar'),
                () => void pegarDesdePortapapeles(),
                <ClipboardPaste className="size-4" />
              )}
            </div>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[1fr_16rem]">
            <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-950 dark:bg-zinc-900 dark:text-zinc-100">
                  <tr>
                    <th className="px-3 py-2 text-left whitespace-nowrap">{t('prrocesardte_item')}</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">{t('prrocesardte_codigo')}</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap">{t('prrocesardte_fecha')}</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap">{t('prrocesardte_acciones')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="px-3 py-2 text-center text-muted-foreground">{it.numItem}</td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={it.codGen}
                          onChange={(e) => updateItem(idx, 'codGen', e.target.value)}
                          placeholder={t('prrocesardte_codigo_placeholder')}
                          className="w-full min-w-[14rem] bg-transparent px-2 py-1 text-sm focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <FechaEmiInput
                          value={it.fechaEmi}
                          onChange={(value) => updateItem(idx, 'fechaEmi', value)}
                          placeholder={t('prrocesardte_fecha_placeholder')}
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={() => eliminarItem(idx)}
                              disabled={idx === 0}
                              aria-label={t('prrocesardte_tooltip_eliminar')}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('prrocesardte_tooltip_eliminar')}</TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <UploadTableHints title={t('prrocesardte_hints_entrada_title')}>
              {t('prrocesardte_hints_entrada_body', { max: MAX_ITEMS })}
            </UploadTableHints>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-4 py-3 dark:border-white/10">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={enrichCreditNotes}
                onCheckedChange={setEnrichCreditNotes}
                aria-label="Verificar notas de crédito relacionadas"
                disabled
              />
              Verificar notas de crédito relacionadas
            </label>
            <Button type="button" onClick={() => void validar()} disabled={loading || items.length === 0}>
              {loading ? t('prrocesardte_validando') : t('prrocesardte_validar')}
            </Button>
            {loading && progressTotal > 0 && (
              <span className="text-sm text-muted-foreground">
                {progressDone}/{progressTotal}
              </span>
            )}
            {errorGlobal && <span className="text-sm text-destructive">{errorGlobal}</span>}
          </div>
        </section>

        <UploadResultsReveal visible={resultsVisible && data.length > 0}>
          <UploadTableToolbar
            resultCount={{ filtered: filtered.length, total: data.length }}
            export={{
              excel: {
                href: downloadHref,
                download: filename,
                label: t('prrocesardte_exportar'),
              },
              csv: {
                onClick: () =>
                  exportRowsToCsv(
                    data as Record<string, unknown>[],
                    buildExportFilename('verificacion_individual', 'csv')
                  ),
              },
              pdf: {
                onClick: () =>
                  exportPdfByProfile(
                    data as Record<string, unknown>[],
                    'verificador',
                    buildExportFilename('verificacion_individual', 'pdf')
                  ),
              },
            }}
            filters={{
              activeCount: countBasicFilters(search, rowsPerPage),
              onClear: () => {
                setSearch('');
                setRowsPerPage(10);
                setCurrentPage(1);
              },
              children: (
                <UploadTableBasicFilters
                  search={search}
                  onSearchChange={(value) => {
                    setSearch(value);
                    setCurrentPage(1);
                  }}
                  searchPlaceholder={t('prrocesardte_buscar_placeholder')}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(value) => {
                    setRowsPerPage(value);
                    setCurrentPage(1);
                  }}
                />
              ),
            }}
          />

          <div className="mt-4 overflow-hidden rounded-md border border-slate-200 dark:border-white/10">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-slate-950 backdrop-blur supports-[backdrop-filter]:bg-slate-100/90 dark:bg-zinc-900 dark:text-zinc-100">
                  <tr>
                    {DTE_RESULT_COLUMNS.map((col) => (
                      <th key={col.key} className="whitespace-nowrap p-2 text-left font-semibold">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedData.length === 0 && (
                    <tr>
                      <td colSpan={DTE_RESULT_COLUMNS.length} className="p-6 text-center text-muted-foreground">
                        {loading ? t('prrocesardte_validando') : t('prrocesardte_sin_resultados')}
                      </td>
                    </tr>
                  )}
                  {paginatedData.map((r, i) => (
                    <tr key={r.codGen || r.codigoGeneracion || i} className="transition-colors hover:bg-muted/40">
                      {DTE_RESULT_COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className={`p-2 align-top ${isDteResultLongTextColumn(col.key) ? 'max-w-xs whitespace-normal break-words' : 'whitespace-nowrap'}`}
                        >
                          {renderDteResultCell(col.key, r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-black sm:flex-row">
              <span className="text-sm text-muted-foreground">
                {t('prrocesardte_pagina', { current: currentPage, total: totalPages })}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </UploadResultsReveal>
      </main>
    </PlanGate>
  );
}
