'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ExternalLink,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import UploadTableToolbar from '@/components/upload/UploadTableToolbar';
import UploadTableBasicFilters, {
  countBasicFilters,
} from '@/components/upload/UploadTableBasicFilters';
import { Button } from '@/components/ui/button';
import {
  buildExportFilename,
  exportPdfByProfile,
  exportRowsToCsv,
  exportRowsToExcel,
} from '@/lib/upload-table-export';
import { formatMontoDisplay } from '@/lib/dte-result-normalize';
import { estadoClassDteJson, type DteJsonResultado } from '@/lib/dte-json-result';

export type DteJsonResultsProfile = 'consultarjson' | 'email';

type Props = {
  results: DteJsonResultado[];
  loading?: boolean;
  profile?: DteJsonResultsProfile;
  showFileColumn?: boolean;
  emptyMessage?: string;
};

export default function DteJsonResultsTable({
  results,
  loading = false,
  profile = 'consultarjson',
  showFileColumn = false,
  emptyMessage,
}: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return results;
    return results.filter((r) => {
      const campos = [
        r.codGen,
        r.codigoGeneracion,
        r.estado,
        r.descripcionEstado,
        r.fechaEmi,
        r.tipoDte,
        r.numeroControl,
        r.emisorNombre,
        r.emisorNit,
        r.receptorNombre,
        r.receptorNit,
        r.nombreArchivo,
        r.documentoAjustado,
        r.observacionesTexto,
        r.relacionadosTexto,
        r.notaCreditoCodigoGeneracion,
        r.notaCreditoEstado,
        r.notaCreditoFechaEmi,
      ];
      return campos.some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [results, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filtered.length, rowsPerPage, totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage, rowsPerPage]);

  const exportBase =
    profile === 'email' ? 'verificacion_correo_json' : 'consultar_json';
  const exportSheet =
    profile === 'email' ? 'Verificacion correo' : 'Consultar JSON';

  if (!loading && !results.length) return null;

  return (
    <div className="space-y-3">
      <UploadTableToolbar
        resultCount={{ filtered: filtered.length, total: results.length }}
        export={{
          excel: {
            onClick: () =>
              exportRowsToExcel(
                results as Record<string, unknown>[],
                buildExportFilename(exportBase, 'xlsx'),
                exportSheet
              ),
          },
          csv: {
            onClick: () =>
              exportRowsToCsv(
                results as Record<string, unknown>[],
                buildExportFilename(exportBase, 'csv')
              ),
          },
          pdf: {
            onClick: () =>
              exportPdfByProfile(
                results as Record<string, unknown>[],
                profile === 'email' ? 'consultarjson' : 'consultarjson',
                buildExportFilename(exportBase, 'pdf')
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
              searchPlaceholder={t('consultarjson_buscar_placeholder')}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(value) => {
                setRowsPerPage(value);
                setCurrentPage(1);
              }}
            />
          ),
        }}
      />

      <div className="overflow-hidden rounded-md border">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur supports-[backdrop-filter]:bg-muted/50">
              <tr>
                {showFileColumn ? (
                  <th className="whitespace-nowrap p-2 text-left">Archivo</th>
                ) : null}
                <th className="whitespace-nowrap p-2 text-left">
                  {t('consultarjson_codigo')}
                </th>
                <th className="whitespace-nowrap p-2 text-left">
                  {t('consultarjson_estado')}
                </th>
                <th className="p-2 text-left">{t('consultarjson_descripcion')}</th>
                <th className="whitespace-nowrap p-2 text-left">
                  {t('consultarjson_fecha')}
                </th>
                <th className="whitespace-nowrap p-2 text-left">
                  {t('consultarjson_tipo')}
                </th>
                <th className="whitespace-nowrap p-2 text-left">
                  {t('consultarjson_control')}
                </th>
                <th className="p-2 text-left">{t('consultarjson_emisor')}</th>
                <th className="p-2 text-left">{t('consultarjson_receptor')}</th>
                <th className="whitespace-nowrap p-2 text-left">
                  {t('consultarjson_monto')}
                </th>
                <th className="whitespace-nowrap p-2 text-left">
                  {t('consultarjson_total')}
                </th>
                <th className="whitespace-nowrap p-2 text-left">
                  {t('consultarjson_iva')}
                </th>
                <th className="whitespace-nowrap p-2 text-left">Ajustado</th>
                <th className="whitespace-nowrap p-2 text-left">Código NC</th>
                <th className="whitespace-nowrap p-2 text-left">Estado NC</th>
                <th className="whitespace-nowrap p-2 text-left">Abrir NC</th>
                <th className="p-2 text-left">{t('consultarjson_enlace')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.length === 0 && (
                <tr>
                  <td
                    colSpan={showFileColumn ? 17 : 16}
                    className="p-6 text-center text-muted-foreground"
                  >
                    {loading
                      ? t('consultarjson_cargando')
                      : emptyMessage || t('consultarjson_sin_resultados')}
                  </td>
                </tr>
              )}

              {paginated.map((r, i) => {
                const codigo = r.codGen || r.codigoGeneracion || '—';
                const link = r.linkVisita || r.url;
                return (
                  <tr
                    key={`${codigo}-${i}`}
                    className="transition-colors hover:bg-muted/40"
                  >
                    {showFileColumn ? (
                      <td className="p-2 align-top">{r.nombreArchivo || '—'}</td>
                    ) : null}
                    <td className="whitespace-nowrap p-2">{codigo}</td>
                    <td className="whitespace-nowrap p-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${estadoClassDteJson(r.estado)}`}
                      >
                        {r.estado || '—'}
                      </span>
                    </td>
                    <td className="p-2">{r.descripcionEstado || r.error || '-'}</td>
                    <td className="whitespace-nowrap p-2">{r.fechaEmi || '—'}</td>
                    <td className="whitespace-nowrap p-2">{r.tipoDte || '-'}</td>
                    <td className="whitespace-nowrap p-2">{r.numeroControl || '-'}</td>
                    <td className="p-2">
                      <div className="leading-tight">
                        <div className="font-medium">{r.emisorNombre || '-'}</div>
                        <div className="text-xs text-muted-foreground">
                          NIT {r.emisorNit || '-'} · NRC {r.emisorNrc || '-'}
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="leading-tight">
                        <div className="font-medium">{r.receptorNombre || '-'}</div>
                        <div className="text-xs text-muted-foreground">
                          NIT {r.receptorNit || '-'} · NRC {r.receptorNrc || '-'}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-2">
                      {formatMontoDisplay(r.montoTotal)}
                    </td>
                    <td className="whitespace-nowrap p-2">
                      {formatMontoDisplay(r.totalPagarOperacion)}
                    </td>
                    <td className="whitespace-nowrap p-2">
                      {formatMontoDisplay(r.ivaOperaciones)}
                    </td>
                    <td className="whitespace-nowrap p-2">
                      {r.ajustado ? 'Sí' : r.documentoAjustado ? 'Sí' : 'No'}
                    </td>
                    <td className="whitespace-nowrap p-2">
                      {r.notaCreditoCodigoGeneracion || '-'}
                    </td>
                    <td className="whitespace-nowrap p-2">
                      {r.notaCreditoEstado || '-'}
                    </td>
                    <td className="whitespace-nowrap p-2">
                      {r.notaCreditoLinkVisita ? (
                        <a
                          href={r.notaCreditoLinkVisita}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 underline"
                        >
                          Abrir NC <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-2">
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 underline"
                        >
                          {t('consultarjson_ver')} <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t bg-background/60 px-3 py-2 sm:flex-row">
          <span className="text-sm text-muted-foreground">
            {t('consultarjson_pagina')}{' '}
            <span className="font-medium text-foreground">{currentPage}</span>{' '}
            {t('consultarjson_de2')} {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
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
    </div>
  );
}
