// app/consultarjson/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import UploadFormSection from '@/components/upload/UploadFormSection'
import UploadFormAccordion from '@/components/upload/UploadFormAccordion'
import UploadResultsReveal from '@/components/upload/UploadResultsReveal'
import UploadTableToolbar from '@/components/upload/UploadTableToolbar'
import UploadTableBasicFilters, { countBasicFilters } from '@/components/upload/UploadTableBasicFilters'
import {
  buildExportFilename,
  exportPdfByProfile,
  exportRowsToCsv,
  exportRowsToExcel,
} from '@/lib/upload-table-export'
import { useUploadResultsReveal } from '@/components/upload/useUploadResultsReveal'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, ExternalLink } from 'lucide-react'
import { formatMontoDisplay } from '@/lib/dte-result-normalize'
import { recordProcessingLog } from '@/lib/client-processing-log'
import { summarizeFiles, summarizeResults } from '@/lib/processing-log'
import { summarizeDteUploadResults } from '@/lib/upload-dte-stats'

type Resultado = {
  ambiente: string
  codGen: string
  fechaEmi: string
  url: string
  linkVisita?: string
  estado: 'EMITIDO' | 'ANULADO' | 'RECHAZADO' | 'NO ENCONTRADO' | 'ERROR'
  descripcionEstado?: string
  error?: string

  tipoDte?: string
  numeroControl?: string
  selloRecepcion?: string
  emisorNit?: string
  emisorNrc?: string
  emisorNombre?: string
  receptorNit?: string
  receptorNrc?: string
  receptorNombre?: string
  montoTotal?: string
  totalPagarOperacion?: string
  ivaOperaciones?: string
  ajustado?: boolean
  documentoAjustado?: string
  tieneNotaCredito?: boolean
  notaCreditoCodigoGeneracion?: string
  notaCreditoFechaGeneracion?: string
  notaCreditoFechaEmi?: string
  notaCreditoSelloRecepcion?: string
  notaCreditoEstado?: string
  notaCreditoLinkVisita?: string
  observacionesTexto?: string
  relacionadosTexto?: string
}

export default function ConsultarJsonPage() {
  const { t } = useTranslation();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Resultado[]>([])

  // UIX
  const [search, setSearch] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const {
    resultsVisible,
    accordionApiRef,
    resetResultsVisibility,
    onResultsReveal,
  } = useUploadResultsReveal()
  
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedFiles.length === 0) {
      toast.warning(t('consultarjson_selecciona_archivos'))
      return
    }
    setLoading(true)
    resetResultsVisibility()
    setData([])
    setCurrentPage(1)
    const startedAt = new Date()
    const started = performance.now()

    try {
      const fd = new FormData()
      selectedFiles.forEach(f => fd.append('files', f))

      const res = await fetch('/api/verificararchjson', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || t('consultarjson_error'))
      }

      const json = await res.json() as { resultados: Resultado[] }
      setData(json.resultados || [])
      accordionApiRef.current?.setProcessingSummary(
        summarizeDteUploadResults(json.resultados || [])
      )
      toast.success(t('consultarjson_completada'))
      await recordProcessingLog({
        routeKey: 'consultarjson',
        moduleName: 'Consultar JSON',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: summarizeFiles(selectedFiles),
        ...summarizeResults(json.resultados || []),
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('consultarjson_error')
      toast.error(message)
      await recordProcessingLog({
        routeKey: 'consultarjson',
        moduleName: 'Consultar JSON',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: summarizeFiles(selectedFiles),
        totalRecords: 0,
        successCount: 0,
        errorCount: selectedFiles.length || 1,
        statusBreakdown: { ERROR: selectedFiles.length || 1 },
        outcome: 'error',
        errorMessage: message,
      })
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(r => {
      const campos = [
        r.codGen, r.estado, r.descripcionEstado, r.fechaEmi, r.tipoDte, r.numeroControl,
        r.emisorNombre, r.emisorNit, r.receptorNombre, r.receptorNit,
        r.documentoAjustado, r.observacionesTexto, r.relacionadosTexto,
        r.notaCreditoCodigoGeneracion, r.notaCreditoEstado, r.notaCreditoFechaEmi,
      ]
      return campos.some(v => (v || '').toLowerCase().includes(q))
    })
  }, [data, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages) }, [filtered.length, rowsPerPage, totalPages, currentPage])
  useEffect(() => { setCurrentPage(1) }, [search])

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, currentPage, rowsPerPage])

  const estadoClass = (estado: Resultado['estado']) => ({
    'EMITIDO': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    'ANULADO': 'bg-primary/15 text-primary bg-primary/15 text-primary',
    'RECHAZADO': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    'NO ENCONTRADO': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    'ERROR': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  }[estado] || '')

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted px-4 py-12 dark:bg-background">

      <Card className="w-full max-w-7xl shadow-xl border-border/60">
        <CardContent className="space-y-6 pt-6">
          <form onSubmit={onSubmit} className="overflow-hidden rounded-md border border-border/60">
            <UploadFormAccordion
              accordionApiRef={accordionApiRef}
              onResultsReveal={onResultsReveal}
              hasResults={resultsVisible && data.length > 0}
              collapseWhenResults
            >
            <UploadFormSection
              label={t('consultarjson_archivos')}
              briefHint="JSON de DTE"
              helpContent={t('consultarjson_desc')}
              files={selectedFiles}
              onFilesChange={setSelectedFiles}
              loading={loading}
              submitLabel={t('consultarjson_verificar')}
              loadingLabel={t('consultarjson_verificando')}
              submitClassName="w-full sm:w-auto"
              accept={{ 'application/json': ['.json'] }}
            />

            </UploadFormAccordion>
          </form>

          <UploadResultsReveal visible={resultsVisible && data.length > 0}>
          <UploadTableToolbar
            resultCount={{ filtered: filtered.length, total: data.length }}
            export={{
              excel: {
                onClick: () =>
                  exportRowsToExcel(
                    data as Record<string, unknown>[],
                    buildExportFilename('consultar_json', 'xlsx'),
                    'Consultar JSON'
                  ),
              },
              csv: {
                onClick: () =>
                  exportRowsToCsv(
                    data as Record<string, unknown>[],
                    buildExportFilename('consultar_json', 'csv')
                  ),
              },
              pdf: {
                onClick: () =>
                  exportPdfByProfile(
                    data as Record<string, unknown>[],
                    'consultarjson',
                    buildExportFilename('consultar_json', 'pdf')
                  ),
              },
            }}
            filters={{
              activeCount: countBasicFilters(search, rowsPerPage),
              onClear: () => {
                setSearch('')
                setRowsPerPage(10)
                setCurrentPage(1)
              },
              children: (
                <UploadTableBasicFilters
                  search={search}
                  onSearchChange={(value) => {
                    setSearch(value)
                    setCurrentPage(1)
                  }}
                  searchPlaceholder={t('consultarjson_buscar_placeholder')}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(value) => {
                    setRowsPerPage(value)
                    setCurrentPage(1)
                  }}
                />
              ),
            }}
          />

          {/* Tabla */}
          <div className="rounded-md border overflow-hidden">
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/70 sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-muted/50">
                  <tr>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_codigo')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_estado')}</th>
                    <th className="text-left p-2">{t('consultarjson_descripcion')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_fecha')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_tipo')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_control')}</th>
                    <th className="text-left p-2">{t('consultarjson_emisor')}</th>
                    <th className="text-left p-2">{t('consultarjson_receptor')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_monto')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_total')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_iva')}</th>
                    <th className="text-left p-2 whitespace-nowrap">Ajustado</th>
                    <th className="text-left p-2 whitespace-nowrap">Código NC</th>
                    <th className="text-left p-2 whitespace-nowrap">Estado NC</th>
                    <th className="text-left p-2 whitespace-nowrap">Abrir NC</th>
                    <th className="text-left p-2">{t('consultarjson_enlace')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={16} className="p-6 text-center text-muted-foreground">
                        {loading ? t('consultarjson_cargando') : t('consultarjson_sin_resultados')}
                      </td>
                    </tr>
                  )}

                  {paginated.map((r, i) => (
                    <tr key={`${r.codGen}-${i}`} className="hover:bg-muted/40 transition-colors">
                      <td className="p-2 whitespace-nowrap">{r.codGen}</td>
                      <td className="p-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${estadoClass(r.estado)}`}>{r.estado}</span>
                      </td>
                      <td className="p-2">{r.descripcionEstado || r.error || '-'}</td>
                      <td className="p-2 whitespace-nowrap">{r.fechaEmi}</td>
                      <td className="p-2 whitespace-nowrap">{r.tipoDte || '-'}</td>
                      <td className="p-2 whitespace-nowrap">{r.numeroControl || '-'}</td>
                      <td className="p-2">
                        <div className="leading-tight">
                          <div className="font-medium">{r.emisorNombre || '-'}</div>
                          <div className="text-xs text-muted-foreground">NIT {r.emisorNit || '-'} · NRC {r.emisorNrc || '-'}</div>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="leading-tight">
                          <div className="font-medium">{r.receptorNombre || '-'}</div>
                          <div className="text-xs text-muted-foreground">NIT {r.receptorNit || '-'} · NRC {r.receptorNrc || '-'}</div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">{formatMontoDisplay(r.montoTotal)}</td>
                      <td className="p-2 whitespace-nowrap">{formatMontoDisplay(r.totalPagarOperacion)}</td>
                      <td className="p-2 whitespace-nowrap">{formatMontoDisplay(r.ivaOperaciones)}</td>
                      <td className="p-2 whitespace-nowrap">{r.ajustado ? 'Sí' : r.documentoAjustado ? 'Sí' : 'No'}</td>
                      <td className="p-2 whitespace-nowrap">{r.notaCreditoCodigoGeneracion || '-'}</td>
                      <td className="p-2 whitespace-nowrap">{r.notaCreditoEstado || '-'}</td>
                      <td className="p-2 whitespace-nowrap">
                        {r.notaCreditoLinkVisita ? (
                          <a href={r.notaCreditoLinkVisita} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 underline text-xs">
                            Abrir NC <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : '-'}
                      </td>
                      <td className="p-2">
                        {(r.linkVisita || r.url) ? (
                          <a href={r.linkVisita || r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 underline text-xs">
                            {t('consultarjson_ver')} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginador */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2 border-t bg-background/60">
              <span className="text-sm text-muted-foreground">
                {t('consultarjson_pagina')} <span className="font-medium text-foreground">{currentPage}</span> {t('consultarjson_de2')} {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}><ChevronsLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}><ChevronsRight className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
          </UploadResultsReveal>
        </CardContent>
      </Card>
    </main>
  )
}
