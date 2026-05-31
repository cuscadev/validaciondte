'use client'

import PlanGate from '@/components/PlanGate'
import UploadFormSection from '@/components/upload/UploadFormSection'
import UploadFormAccordion from '@/components/upload/UploadFormAccordion'
import UploadResultsReveal from '@/components/upload/UploadResultsReveal'
import UploadTableExportBar from '@/components/upload/UploadTableExportBar'
import {
  buildExportFilename,
  exportPdfByProfile,
  exportRowsToCsv,
} from '@/lib/upload-table-export'
import UploadTableHints from '@/components/upload/UploadTableHints'
import HelpTooltip from '@/components/upload/HelpTooltip'
import UploadTemplateDownloadButton from '@/components/upload/UploadTemplateDownloadButton'
import { useUploadResultsReveal } from '@/components/upload/useUploadResultsReveal'
import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { recordProcessingLog } from '@/lib/client-processing-log'
import { summarizeFiles, summarizeResults } from '@/lib/processing-log'
import { summarizeDteUploadResults } from '@/lib/upload-dte-stats'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react'
import { toast } from 'sonner'

const FORMAT_HELP = (
  <div className="space-y-2">
    <p>
      Usa la plantilla para evitar errores. El archivo debe contener enlaces completos de consulta
      pública de Hacienda (consultaPublica con ambiente, codGen y fechaEmi).
    </p>
    <ul className="list-disc space-y-1 pl-4 text-xs opacity-90">
      <li><strong>Columna enlace:</strong> URL completa de admin.factura.gob.sv o webapp.dtes.mh.gob.sv.</li>
      <li><strong>Archivos:</strong> Acepta .csv, .txt, .xlsx, .xls y .xlsm.</li>
      <li>Puedes poner varios enlaces en filas distintas o en celdas del Excel.</li>
    </ul>
    <p className="text-xs opacity-90">
      Descarga la plantilla verde para ver el formato correcto de los enlaces.
    </p>
  </div>
)

type Resultado = {
  url: string
  host: string
  ambiente: string
  codGen: string
  fechaEmi: string
  estado: string
  estadoRaw?: string
  descripcionEstado?: string
  tipoDte?: string
  fechaHoraGeneracion?: string
  fechaHoraTransmision?: string
  fechaHoraProcesamiento?: string
  codigoGeneracion?: string
  selloRecepcion?: string
  numeroControl?: string
  montoTotal?: string
  ivaOperaciones?: string
  ivaPercibido?: string
  ivaRetenido?: string
  retencionRenta?: string
  totalNoAfectos?: string
  totalPagarOperacion?: string
  otrosTributos?: string
  documentoAjustado?: string
  documentoEventoAplicado?: string
  observacionesTexto?: string
  observaciones?: Array<{ numero: string; observacion: string }>
  error?: string

  /* 🔗 NUEVO: datos para visitar el enlace */
  linkVisita?: string   // viene del backend; si falta, usamos url
  visitar?: string      // texto visible (p.ej. "Abrir")
}

export default function HomePage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Resultado[]>([])
  const [downloadHref, setDownloadHref] = useState<string | null>(null)
  const [filename, setFilename] = useState('resultados_dtes.xlsx')

  // 🔎 UIX: búsqueda & paginación
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
      toast.warning('Selecciona uno o más archivos CSV o Excel')
      return
    }

    setLoading(true)
    resetResultsVisibility()
    setData([])
    setDownloadHref(null)
    setCurrentPage(1)
    const startedAt = new Date()
    const started = performance.now()

    try {
      const fd = new FormData()
      selectedFiles.forEach((f) => fd.append('files', f))

      const res = await fetch('/api/procesar', { method: 'POST', body: fd })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || 'Error al procesar')
      }

      const json = await res.json() as {
        resultados: Resultado[]
        excelBase64?: string
        downloadUrl?: string
        filename?: string
      }
      setData(json.resultados || [])
      accordionApiRef.current?.setProcessingSummary(
        summarizeDteUploadResults(json.resultados || [])
      )
      setFilename(json.filename || 'resultados_dtes.xlsx')

      setDownloadHref(
        json.downloadUrl ||
        (json.excelBase64
          ? `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${json.excelBase64}`
          : null)
      )

      toast.success('Procesamiento finalizado. Revisa la tabla y descarga el Excel.')
      await recordProcessingLog({
        routeKey: 'verificador',
        moduleName: 'Verificador Links CSV',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: summarizeFiles(selectedFiles),
        ...summarizeResults(json.resultados || []),
      })
    } catch (e: any) {
      toast.error(e?.message || 'Error inesperado')
      await recordProcessingLog({
        routeKey: 'verificador',
        moduleName: 'Verificador Links CSV',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: summarizeFiles(selectedFiles),
        totalRecords: 0,
        successCount: 0,
        errorCount: selectedFiles.length,
        statusBreakdown: { ERROR: selectedFiles.length },
        outcome: 'error',
        errorMessage: e?.message || 'Error inesperado',
      })
    } finally {
      setLoading(false)
    }
  }

  const columnas = useMemo(() => ([
    { key: 'codGen', label: 'Código Generación' },
    { key: 'estado', label: 'Estado' },
    { key: 'descripcionEstado', label: 'Descripción Estado' },
    { key: 'tipoDte', label: 'Tipo DTE' },
    { key: 'fechaHoraGeneracion', label: 'Fecha Generación' },
    { key: 'numeroControl', label: 'N° Control' },
    { key: 'montoTotal', label: 'Monto Total' },
    { key: 'error', label: 'Error' },
    /* 🆕 Columna para visitar */
    { key: 'visitar', label: 'Visitar' },
  ] as const), [])

  // 🔎 Filtro por búsqueda (incluye linkVisita/url por si pegan URL)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(r => {
      const campos = [
        r.codGen, r.estado, r.descripcionEstado, r.tipoDte,
        r.numeroControl, r.montoTotal, r.fechaHoraGeneracion, r.observacionesTexto,
        r.linkVisita, r.url
      ]
      return campos.some(v => (v || '').toLowerCase().includes(q))
    })
  }, [data, search])

  // 📄 Paginación
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [filtered.length, rowsPerPage, totalPages, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, currentPage, rowsPerPage])

  const hayDatos = filtered.length > 0

  // helper para color del estado (añadí INVALIDADO)
  const estadoPill = (v?: string) => {
    if (!v) return ''
    switch (v) {
      case 'EMITIDO':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
      case 'ANULADO':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
      case 'RECHAZADO':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
      case 'INVALIDADO':
        return 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  return (
    <PlanGate routeKey="verificador">
    <main className="w-full max-w-full dark:bg-background">
      <Card className="w-full max-w-full overflow-hidden border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <CardContent className="space-y-6 pt-6">
          <form onSubmit={onSubmit} className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            <UploadFormAccordion
              accordionApiRef={accordionApiRef}
              onResultsReveal={onResultsReveal}
              hasResults={resultsVisible && data.length > 0}
              collapseWhenResults
            >
            <UploadFormSection
              label="Archivos CSV o Excel"
              briefHint="CSV o Excel con enlaces MH"
              helpContent={
                <>
                  <p>
                    Sube uno o varios archivos CSV o Excel con enlaces de Hacienda. Veras una tabla con los resultados y podras descargar el Excel.
                  </p>
                  <p className="mt-2 text-xs opacity-90">Acepta .csv, .txt, .xlsx, .xls y .xlsm</p>
                </>
              }
              helpTooltip={<HelpTooltip content={FORMAT_HELP} side="top" />}
              labelActions={
                <UploadTemplateDownloadButton href="/api/procesar/plantilla" />
              }
              files={selectedFiles}
              onFilesChange={setSelectedFiles}
              loading={loading}
              accept={{
                'text/csv': ['.csv', '.txt'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xlsm'],
                'application/vnd.ms-excel': ['.xls'],
              }}
              sidePanel={
                <UploadTableHints>
                  Revisa el estado de cada DTE, usa el buscador para ubicar códigos o números de control y abre el enlace de la columna Visitar cuando necesites validar el documento en Hacienda.
                </UploadTableHints>
              }
            />

            </UploadFormAccordion>
          </form>

          <UploadResultsReveal visible={resultsVisible && data.length > 0}>
          {/* Barra de herramientas de tabla */}
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="hidden sm:inline">Resultados:</span>
              <span className="font-medium text-foreground">{filtered.length}</span>
              {filtered.length !== data.length && (
                <span className="text-xs">(de {data.length} totales)</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <UploadTableExportBar
                excel={{
                  href: downloadHref,
                  download: filename,
                  label: 'Descargar Excel completo',
                }}
                csv={{
                  onClick: () =>
                    exportRowsToCsv(
                      data as Record<string, unknown>[],
                      buildExportFilename('resultados_dtes', 'csv')
                    ),
                }}
                pdf={{
                  onClick: () =>
                    exportPdfByProfile(
                      data as Record<string, unknown>[],
                      'verificador',
                      buildExportFilename('resultados_dtes', 'pdf')
                    ),
                }}
              />
              {/* Search */}
              <div className="relative">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por código, estado, N° control…"
                  className="pl-9 w-[280px]"
                />
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>

              {/* Rows per page */}
              <div className="flex items-center gap-2">
                <Label htmlFor="rpp" className="text-sm">Filas</Label>
                <select
                  id="rpp"
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1) }}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-hidden rounded-md border border-slate-200 dark:border-white/10">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-slate-950 backdrop-blur supports-[backdrop-filter]:bg-slate-100/90 dark:bg-zinc-900 dark:text-zinc-100">
                  <tr>
                    {columnas.map(col => (
                      <th
                        key={col.key as string}
                        className="text-left p-2 whitespace-nowrap font-semibold"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedData.length === 0 && (
                    <tr>
                      <td colSpan={columnas.length} className="p-6 text-center text-muted-foreground">
                        {loading ? 'Cargando…' : 'Sin resultados para mostrar.'}
                      </td>
                    </tr>
                  )}

                  {paginatedData.map((r, i) => (
                    <tr
                      key={r.codGen || r.url || i}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      {columnas.map(col => {
                        const v = (r as any)[col.key] ?? ''
                        const isEstado = col.key === 'estado'
                        const isVisitar = col.key === 'visitar'
                        return (
                          <td key={col.key as string} className="p-2 align-top whitespace-nowrap">
                            {isEstado ? (
                              <span className={`px-2 py-0.5 rounded-full text-xs ${estadoPill(String(v))}`}>
                                {String(v || '')}
                              </span>
                            ) : isVisitar ? (
                              r.linkVisita || r.url ? (
                                <a
                                  href={r.linkVisita || r.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded-md px-2 py-1 border text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                                  title="Abrir en nueva pestaña"
                                >
                                  {r.visitar || 'Abrir'}
                                </a>
                              ) : (
                                ''
                              )
                            ) : (
                              String(v || '')
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginador */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-black sm:flex-row">
              <span className="text-sm text-muted-foreground">
                Página <span className="font-medium text-foreground">{currentPage}</span> de {totalPages}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          </UploadResultsReveal>
        </CardContent>
      </Card>
    </main>
    </PlanGate>
  )
}
