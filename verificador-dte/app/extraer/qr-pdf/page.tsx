'use client'

import PlanGate from '@/components/PlanGate'
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
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { recordProcessingLog } from '@/lib/client-processing-log'
import { summarizeFiles } from '@/lib/processing-log'
import { summarizeDteUploadResults } from '@/lib/upload-dte-stats'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import jsQR from 'jsqr'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { toast } from 'sonner'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

type QrPdfResultado = {
  Archivo: string
  Ambiente: string
  CodigoGeneracion: string
  FechaEmision: string
  HostOriginal: string
  UrlOriginal: string
  UrlNormalizada: string
  Estado: string
  Error?: string
}

type ColumnKey = keyof QrPdfResultado

const MAX_FILES = 100

export default function QrPdfPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [data, setData] = useState<QrPdfResultado[]>([])
  const [search, setSearch] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const {
    resultsVisible,
    accordionApiRef,
    resetResultsVisibility,
    onResultsReveal,
  } = useUploadResultsReveal()

  const normalizarUrl = (raw: string) => {
    const match = raw.match(/https?:\/\/[^\s"'<>]+/i)

    const urlText = match
      ? match[0].replace(/[,\.;]+$/g, '')
      : raw.trim()

    const url = new URL(urlText)

    const ambiente = url.searchParams.get('ambiente') || '01'
    const codGen = url.searchParams.get('codGen') || ''
    const fechaEmi = url.searchParams.get('fechaEmi') || ''

    if (!codGen || !fechaEmi) {
      throw new Error('El QR no contiene codGen o fechaEmi.')
    }

    const params = new URLSearchParams()

    params.set('ambiente', ambiente)
    params.set('codGen', codGen)
    params.set('fechaEmi', fechaEmi)

    return {
      ambiente,
      codGen,
      fechaEmi,
      hostOriginal: url.host,
      urlOriginal: urlText,
      urlNormalizada: `https://admin.factura.gob.sv/consultaPublica?${params.toString()}`,
    }
  }

  const leerQrDesdePdf = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer()

    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
    }).promise

    const page = await pdf.getPage(1)

    const viewport = page.getViewport({
      scale: 2.5,
    })

    const canvas = document.createElement('canvas')

    const context = canvas.getContext('2d', {
      willReadFrequently: true,
    })

    if (!context) {
      throw new Error('No se pudo preparar el lector.')
    }

    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise

    const imageData = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    )

    const qr = jsQR(
      imageData.data,
      imageData.width,
      imageData.height
    )

    if (!qr?.data) {
      throw new Error(
        'No se encontró código QR en la primera página.'
      )
    }

    return qr.data
  }

  const procesarArchivo = async (
    file: File
  ): Promise<QrPdfResultado> => {
    try {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('El archivo no es PDF.')
      }

      const qrText = await leerQrDesdePdf(file)

      const normalizado = normalizarUrl(qrText)

      return {
        Archivo: file.name,
        Ambiente: normalizado.ambiente,
        CodigoGeneracion: normalizado.codGen,
        FechaEmision: normalizado.fechaEmi,
        HostOriginal: normalizado.hostOriginal,
        UrlOriginal: normalizado.urlOriginal,
        UrlNormalizada: normalizado.urlNormalizada,
        Estado: 'PROCESADO',
        Error: '',
      }
    } catch (error) {
      return {
        Archivo: file.name,
        Ambiente: '',
        CodigoGeneracion: '',
        FechaEmision: '',
        HostOriginal: '',
        UrlOriginal: '',
        UrlNormalizada: '',
        Estado: 'ERROR',
        Error:
          error instanceof Error
            ? error.message
            : 'Error inesperado',
      }
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedFiles.length === 0) {
      toast.warning('Selecciona uno o más archivos PDF.')
      return
    }

    if (selectedFiles.length > MAX_FILES) {
      toast.warning(
        `Solo puedes procesar máximo ${MAX_FILES} archivos PDF por lote.`
      )
      return
    }

    setLoading(true)
    setProgress('')
    resetResultsVisibility()
    setData([])
    setCurrentPage(1)

    const resultados: QrPdfResultado[] = []

    const startedAt = new Date()

    const started = performance.now()

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        setProgress(
          `Procesando ${i + 1} de ${selectedFiles.length}`
        )

        const resultado = await procesarArchivo(
          selectedFiles[i]
        )

        resultados.push(resultado)
      }

      setData(resultados)
      accordionApiRef.current?.setProcessingSummary(
        summarizeDteUploadResults(resultados)
      )

      const successCount = resultados.filter(
        (r) => r.Estado === 'PROCESADO'
      ).length

      const errorCount = resultados.filter(
        (r) => r.Estado === 'ERROR'
      ).length

      toast.success(
        errorCount > 0
          ? `Procesamiento finalizado con ${errorCount} error(es).`
          : 'Procesamiento finalizado.'
      )

      await recordProcessingLog({
        routeKey: 'qr-pdf',
        moduleName: 'Extractor QR desde PDF',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(
          performance.now() - started
        ),
        files: summarizeFiles(selectedFiles),
        totalRecords: resultados.length,
        successCount,
        errorCount,
        statusBreakdown: {
          PROCESADO: successCount,
          ERROR: errorCount,
        },
        outcome:
          errorCount > 0 ? 'error' : 'success',
      })
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error inesperado'

      toast.error(message)

      await recordProcessingLog({
        routeKey: 'qr-pdf',
        moduleName: 'Extractor QR desde PDF',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(
          performance.now() - started
        ),
        files: summarizeFiles(selectedFiles),
        totalRecords: 0,
        successCount: 0,
        errorCount: selectedFiles.length,
        statusBreakdown: {
          ERROR: selectedFiles.length,
        },
        outcome: 'error',
        errorMessage: message,
      })
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const columnas = useMemo(
    () =>
      [
        {
          key: 'Archivo',
          label: 'Archivo',
        },
        {
          key: 'CodigoGeneracion',
          label: 'Código Generación',
        },
        {
          key: 'FechaEmision',
          label: 'Fecha Emisión',
        },
        {
          key: 'Ambiente',
          label: 'Ambiente',
        },
        {
          key: 'HostOriginal',
          label: 'Host Original',
        },
        {
          key: 'Estado',
          label: 'Estado',
        },
        {
          key: 'UrlNormalizada',
          label: 'Enlace',
        },
        {
          key: 'Error',
          label: 'Error',
        },
      ] satisfies Array<{
        key: ColumnKey
        label: string
      }>,
    []
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (!q) return data

    return data.filter((r) =>
      [
        r.Archivo,
        r.CodigoGeneracion,
        r.FechaEmision,
        r.Ambiente,
        r.HostOriginal,
        r.Estado,
        r.UrlOriginal,
        r.UrlNormalizada,
        r.Error,
      ].some((v) =>
        String(v || '')
          .toLowerCase()
          .includes(q)
      )
    )
  }, [data, search])

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / rowsPerPage)
  )

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [
    filtered.length,
    rowsPerPage,
    totalPages,
    currentPage,
  ])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage

    return filtered.slice(
      start,
      start + rowsPerPage
    )
  }, [filtered, currentPage, rowsPerPage])

  const resumen = useMemo(() => {
    return {
      total: filtered.length,
      procesados: filtered.filter(
        (r) => r.Estado === 'PROCESADO'
      ).length,
      errores: filtered.filter(
        (r) => r.Estado === 'ERROR'
      ).length,
      admin: filtered.filter((r) =>
        r.HostOriginal.includes(
          'admin.factura.gob.sv'
        )
      ).length,
      webapp: filtered.filter((r) =>
        r.HostOriginal.includes(
          'webapp.dtes.mh.gob.sv'
        )
      ).length,
    }
  }, [filtered])

  const estadoPill = (estado?: string) => {
    switch (estado) {
      case 'PROCESADO':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'

      case 'ERROR':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'

      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  const renderValue = (
    row: QrPdfResultado,
    key: ColumnKey
  ) => {
    const value = row[key]

    if (key === 'Estado') {
      return (
        <span
          className={`px-2 py-0.5 rounded-full text-xs ${estadoPill(
            String(value)
          )}`}
        >
          {String(value || '')}
        </span>
      )
    }

    if (key === 'UrlNormalizada') {
      if (!value) return ''

      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          Abrir
        </a>
      )
    }

    return String(value || '')
  }

  return (
    <PlanGate routeKey="qr-pdf">
      <main className="w-full max-w-full space-y-6 dark:bg-background">
            <form
              onSubmit={onSubmit}
              className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10"
            >
              <UploadFormAccordion
                accordionApiRef={accordionApiRef}
                onResultsReveal={onResultsReveal}
                hasResults={resultsVisible && data.length > 0}
                collapseWhenResults
              >
              <UploadFormSection
                label="Archivos PDF"
                briefHint="PDF con QR MH"
                helpContent="Sube archivos PDF con codigo QR de Hacienda para extraer codigo de generacion, fecha de emision y enlace normalizado."
                files={selectedFiles}
                onFilesChange={setSelectedFiles}
                loading={loading}
                submitLabel="Extraer"
                accept={{ 'application/pdf': ['.pdf'] }}
              />

              {progress && (
                <div className="rounded-md bg-yellow-100 p-3 text-sm text-yellow-900 dark:bg-yellow-400/15 dark:text-yellow-200">
                  {progress}
                </div>
              )}

              </UploadFormAccordion>
            </form>

            <UploadResultsReveal visible={resultsVisible && data.length > 0}>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Total
                </p>

                <p className="font-bold text-slate-950 dark:text-white">
                  {resumen.total}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Procesados
                </p>

                <p className="font-bold text-slate-950 dark:text-white">
                  {resumen.procesados}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Errores
                </p>

                <p className="font-bold text-slate-950 dark:text-white">
                  {resumen.errores}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Admin factura
                </p>

                <p className="font-bold text-slate-950 dark:text-white">
                  {resumen.admin}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Webapp DTE
                </p>

                <p className="font-bold text-slate-950 dark:text-white">
                  {resumen.webapp}
                </p>
              </div>
            </section>

            <UploadTableToolbar
              resultCount={{ filtered: filtered.length, total: data.length }}
              export={{
                excel: {
                  onClick: () =>
                    exportRowsToExcel(
                      data as Record<string, unknown>[],
                      buildExportFilename('qr_pdf', 'xlsx'),
                      'QR PDF'
                    ),
                },
                csv: {
                  onClick: () =>
                    exportRowsToCsv(
                      data as Record<string, unknown>[],
                      buildExportFilename('qr_pdf', 'csv')
                    ),
                },
                pdf: {
                  onClick: () =>
                    exportPdfByProfile(
                      data as Record<string, unknown>[],
                      'qrPdf',
                      buildExportFilename('qr_pdf', 'pdf')
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
                    searchPlaceholder="Buscar por archivo, código o fecha…"
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(value) => {
                      setRowsPerPage(value)
                      setCurrentPage(1)
                    }}
                  />
                ),
              }}
            />

            <div className="overflow-hidden rounded-md border border-slate-200 dark:border-white/10">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-950 dark:bg-zinc-900 dark:text-zinc-100">
                    <tr>
                      {columnas.map((col) => (
                        <th
                          key={col.key}
                          className="text-left p-2 whitespace-nowrap font-semibold"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {paginatedData.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={
                            columnas.length
                          }
                          className="p-6 text-center text-muted-foreground"
                        >
                          {loading
                            ? 'Cargando…'
                            : 'Sin resultados para mostrar.'}
                        </td>
                      </tr>
                    )}

                    {paginatedData.map(
                      (r, i) => (
                        <tr
                          key={
                            r.CodigoGeneracion ||
                            r.Archivo ||
                            i
                          }
                          className="hover:bg-muted/40 transition-colors"
                        >
                          {columnas.map(
                            (col) => (
                              <td
                                key={
                                  col.key
                                }
                                className="p-2 align-top whitespace-nowrap"
                              >
                                {renderValue(
                                  r,
                                  col.key
                                )}
                              </td>
                            )
                          )}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-black sm:flex-row">
                <span className="text-sm text-muted-foreground">
                  Página{' '}
                  <span className="font-medium text-foreground">
                    {currentPage}
                  </span>{' '}
                  de {totalPages}
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(1)
                    }
                    disabled={
                      currentPage === 1
                    }
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(
                        (p) =>
                          Math.max(
                            1,
                            p - 1
                          )
                      )
                    }
                    disabled={
                      currentPage === 1
                    }
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(
                        (p) =>
                          Math.min(
                            totalPages,
                            p + 1
                          )
                      )
                    }
                    disabled={
                      currentPage ===
                      totalPages
                    }
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(
                        totalPages
                      )
                    }
                    disabled={
                      currentPage ===
                      totalPages
                    }
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            </UploadResultsReveal>
      </main>
    </PlanGate>
  )
}
