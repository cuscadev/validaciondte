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
} from '@/lib/upload-table-export'
import UploadTableHints from '@/components/upload/UploadTableHints'
import HelpTooltip from '@/components/upload/HelpTooltip'
import UploadTemplateDownloadButton from '@/components/upload/UploadTemplateDownloadButton'
import { useUploadResultsReveal } from '@/components/upload/useUploadResultsReveal'
import { useAuth } from '@/components/AuthProvider'
import { auth } from '@/lib/firebase'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { recordProcessingLog } from '@/lib/client-processing-log'
import { summarizeFiles, summarizeResults } from '@/lib/processing-log'
import { summarizeDteUploadResults } from '@/lib/upload-dte-stats'
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import { toast } from 'sonner'

const FORMAT_HELP = (
  <div className="space-y-2">
    <p>
      Usa la plantilla para evitar errores. La primera hoja debe tener dos columnas:
      <strong> codGen</strong> en la columna A y <strong>fecha</strong> en la columna B.
    </p>
    <ul className="list-disc space-y-1 pl-4 text-xs opacity-90">
      <li><strong>Columna A:</strong> Codigo de generacion UUID.</li>
      <li><strong>Columna B:</strong> Fecha en yyyy-MM-dd o dd/MM/yyyy.</li>
      <li><strong>Archivos:</strong> Acepta .xlsx, .xls, .csv y .txt.</li>
    </ul>
    <p className="text-xs opacity-90">
      Ejemplo: A = 12345678-1234-1234-1234-123456789ABC, B = 2026-01-15 o 15/01/2026.
      Puedes incluir encabezados; si la primera fila dice codGen y fecha, el sistema la omitira automaticamente.
    </p>
  </div>
)

type Resultado = {
  nombreArchivo?: string
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
  relacionadosTexto?: string
  tieneNotaCredito?: boolean
  notaCreditoCodigoGeneracion?: string
  notaCreditoFechaGeneracion?: string
  notaCreditoFechaEmi?: string
  notaCreditoSelloRecepcion?: string
  notaCreditoEstado?: string
  notaCreditoLinkVisita?: string
  error?: string
  linkVisita?: string
  visitar?: string
}

type LimitCheck = {
  allowed: boolean
  error?: string
  limit: number | null
  used: number
  incomingRecords: number
  remaining: number | null
}

export default function VerificarPorCodigoYFechaPage() {
  const pathname = usePathname()
  const isConsultasLotes = pathname.startsWith('/consultas-lotes/excel-codigo-fecha')
  const accessRouteKey = isConsultasLotes ? 'consultas_lotes_excel_codigo_fecha' : 'verificarodyfecha'
  const logRouteKey = accessRouteKey
  const moduleName = isConsultasLotes
    ? 'Consultas lotes - Excel codigo y fecha'
    : 'Verificar por Codigo y Fecha'
  const { appUser, firebaseUser } = useAuth()
  const createdBy =
    appUser?.displayName || appUser?.email || firebaseUser?.displayName || firebaseUser?.email || 'Usuario'
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Resultado[]>([])
  const [downloadHref, setDownloadHref] = useState<string | null>(null)
  const [filename, setFilename] = useState('resultados_dtes.xlsx')
  const [limitCheck, setLimitCheck] = useState<LimitCheck | null>(null)
  const [checkingLimit, setCheckingLimit] = useState(false)

  // búsqueda & paginación
  const [search, setSearch] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const {
    resultsVisible,
    accordionApiRef,
    resetResultsVisibility,
    onResultsReveal,
  } = useUploadResultsReveal()

  useEffect(() => {
    let cancelled = false

    async function checkSelectedFiles() {
      setLimitCheck(null)
      if (!selectedFiles.length || !firebaseUser) return

      setCheckingLimit(true)
      try {
        const token = await (firebaseUser || auth.currentUser)?.getIdToken()
        if (!token) throw new Error('No autorizado')
        const fd = new FormData()
        fd.append('routeKey', logRouteKey)
        fd.append('mode', 'cod-fecha')
        selectedFiles.forEach((file) => fd.append('files', file))

        const res = await fetch('/api/usage-limits/check-files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        const data = await res.json() as LimitCheck
        if (!cancelled) setLimitCheck({ ...data, allowed: res.ok && data.allowed !== false })
      } catch (error) {
        if (!cancelled) {
          setLimitCheck({
            allowed: false,
            error: error instanceof Error ? error.message : 'No se pudo validar el limite',
            limit: null,
            used: 0,
            incomingRecords: 0,
            remaining: null,
          })
        }
      } finally {
        if (!cancelled) setCheckingLimit(false)
      }
    }

    void checkSelectedFiles()
    return () => {
      cancelled = true
    }
  }, [firebaseUser, logRouteKey, selectedFiles])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedFiles.length === 0) {
      toast.warning('Selecciona uno o más archivos .xlsx / .csv / .txt')
      return
    }

    if (limitCheck && !limitCheck.allowed) {
      toast.error(limitCheck.error || 'La cantidad de registros supera el limite permitido')
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
      fd.append('routeKey', logRouteKey)
      selectedFiles.forEach((f) => fd.append('files', f))

      const token = await (firebaseUser || auth.currentUser)?.getIdToken()
      if (!token) throw new Error('No autorizado')

      const res = await fetch('/api/verificarcodyfecha', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || 'Error al procesar')
      }

      const json = await res.json() as {
        resultados?: Resultado[]
        excelBase64?: string
        downloadUrl?: string
        filename?: string
      }

      setData(json.resultados || [])
      accordionApiRef.current?.setProcessingSummary(
        summarizeDteUploadResults(json.resultados || [])
      )
      setFilename(json.filename || 'resultados_dtes.xlsx')

      if (json.downloadUrl) {
        setDownloadHref(json.downloadUrl)
      } else if (json.excelBase64) {
        const href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${json.excelBase64}`
        setDownloadHref(href)
      }

      toast.success('Procesamiento finalizado. Revisa la tabla y descarga el Excel.')
      await recordProcessingLog({
        routeKey: logRouteKey,
        moduleName,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: summarizeFiles(selectedFiles),
        ...summarizeResults(json.resultados || []),
      })
    } catch (e: any) {
      toast.error(e?.message || 'Error inesperado')
      await recordProcessingLog({
        routeKey: logRouteKey,
        moduleName,
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
    { key: 'nombreArchivo', label: 'Archivo' },
    { key: 'codGen', label: 'Código Generación' },
    { key: 'fechaEmi', label: 'Fecha Emi.' },
    { key: 'estado', label: 'Estado' },
    { key: 'descripcionEstado', label: 'Descripción Estado' },
    { key: 'tipoDte', label: 'Tipo DTE' },
    { key: 'numeroControl', label: 'N° Control' },
    { key: 'montoTotal', label: 'Monto Total' },
    { key: 'tieneNotaCredito', label: 'Tiene NC' },
    { key: 'notaCreditoCodigoGeneracion', label: 'Codigo NC' },
    { key: 'notaCreditoFechaGeneracion', label: 'Fecha NC' },
    { key: 'notaCreditoFechaEmi', label: 'Fecha Emi NC' },
    { key: 'notaCreditoSelloRecepcion', label: 'Sello NC' },
    { key: 'notaCreditoEstado', label: 'Estado NC' },
    { key: 'notaCreditoLinkVisita', label: 'Abrir NC' },
    { key: 'relacionadosTexto', label: 'Docs. Relacionados' },
    { key: 'error', label: 'Error' },
    { key: 'visitar', label: 'Visitar' },
  ] as const), [])

  // filtro por búsqueda (incluye linkVisita/url)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(r => {
      const campos = [
        r.nombreArchivo, r.codGen, r.fechaEmi, r.estado, r.descripcionEstado, r.tipoDte,
        r.numeroControl, r.montoTotal, r.relacionadosTexto, r.notaCreditoEstado,
        r.notaCreditoCodigoGeneracion, r.notaCreditoFechaGeneracion,
        r.notaCreditoFechaEmi, r.notaCreditoSelloRecepcion, r.linkVisita, r.url
      ]
      return campos.some(v => (v || '').toLowerCase().includes(q))
    })
  }, [data, search])

  // paginación
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
    <PlanGate routeKey={accessRouteKey}>
    <main className="w-full max-w-full space-y-6">
          <form onSubmit={onSubmit} className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            <UploadFormAccordion
              accordionApiRef={accordionApiRef}
              onResultsReveal={onResultsReveal}
              hasResults={resultsVisible && data.length > 0}
              collapseWhenResults
            >
            <UploadFormSection
              label="Archivos (.xlsx, .csv, .txt)"
              briefHint="Columna A = codGen, B = fecha"
              helpContent="Sube archivos Excel, CSV o TXT con columna A = codGen y columna B = fecha. Veras los resultados y podras descargar el Excel consolidado."
              helpTooltip={<HelpTooltip content={FORMAT_HELP} side="top" />}
              labelActions={
                <UploadTemplateDownloadButton href="/api/verificarcodyfecha" />
              }
              files={selectedFiles}
              onFilesChange={setSelectedFiles}
              loading={loading || checkingLimit}
              accept={{
                'text/csv': ['.csv', '.txt'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              }}
              sidePanel={
                <UploadTableHints>
                  Confirma que cada fila tenga código y fecha válidos, revisa el estado devuelto por Hacienda y filtra por código, fecha o estado para localizar resultados específicos.
                </UploadTableHints>
              }
            />

            </UploadFormAccordion>
          </form>

          {limitCheck && limitCheck.limit !== null && (
            <div className={`rounded-md border px-4 py-3 text-sm ${limitCheck.allowed ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'}`}>
              {limitCheck.allowed
                ? `Este proceso usara ${limitCheck.incomingRecords} consultas. Llevas ${limitCheck.used} de ${limitCheck.limit}; te quedaran ${limitCheck.remaining}.`
                : limitCheck.error || `Estos archivos tienen ${limitCheck.incomingRecords} consultas y superan tu saldo mensual disponible.`}
            </div>
          )}

          <UploadResultsReveal visible={resultsVisible && data.length > 0}>
          <UploadTableToolbar
            resultCount={{ filtered: filtered.length, total: data.length }}
            export={{
              excel: {
                href: downloadHref,
                download: filename,
                label: 'EXCEL',
              },
              csv: {
                onClick: () =>
                  exportRowsToCsv(
                    data as Record<string, unknown>[],
                    buildExportFilename('resultados_dtes', 'csv')
                  ),
              },
              pdf: {
                onClick: () =>
                  exportPdfByProfile(
                    data as Record<string, unknown>[],
                    'verificador',
                    buildExportFilename('resultados_dtes', 'pdf'),
                    {
                      title: 'Reporte de verificacion por codigo y fecha',
                      createdBy,
                    }
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
                  searchPlaceholder="Buscar por código, fecha, estado…"
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
                        const isEstado = col.key === 'estado' || col.key === 'notaCreditoEstado'
                        const isVisitar = col.key === 'visitar'
                        const isNotaCreditoLink = col.key === 'notaCreditoLinkVisita'
                        const isBool = col.key === 'tieneNotaCredito'
                        const isLongText = col.key === 'relacionadosTexto' || col.key === 'descripcionEstado'
                        return (
                          <td
                            key={col.key as string}
                            className={`p-2 align-top ${isLongText ? 'max-w-xs whitespace-normal break-words' : 'whitespace-nowrap'}`}
                          >
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
                            ) : isNotaCreditoLink ? (
                              r.notaCreditoLinkVisita ? (
                                <a
                                  href={r.notaCreditoLinkVisita}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded-md px-2 py-1 border text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                                  title="Abrir nota de credito en Hacienda"
                                >
                                  Abrir NC
                                </a>
                              ) : (
                                ''
                              )
                            ) : isBool ? (
                              v === true || v === 'true' ? 'Si' : v === false || v === 'false' ? 'No' : String(v || '')
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
    </main>
    </PlanGate>
  )
}
