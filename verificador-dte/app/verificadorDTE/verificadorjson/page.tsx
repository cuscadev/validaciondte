'use client'

import PlanGate from '@/components/PlanGate'
import { useUploadVerifierTourResultsReady } from '@/lib/product-tours/hooks/useUploadVerifierTourResultsReady'
import { VERIFICADOR_JSON_TOUR_ID } from '@/lib/product-tours/tours/verificador-tours'
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
import { useUploadResultsReveal } from '@/components/upload/useUploadResultsReveal'
import { useAuth } from '@/components/AuthProvider'
import { auth } from '@/lib/firebase'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { recordProcessingLog } from '@/lib/client-processing-log'
import { summarizeFiles, summarizeResults } from '@/lib/processing-log'
import { summarizeDteUploadResults } from '@/lib/upload-dte-stats'
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react'
import { toast } from 'sonner'

type Resultado = {
  nombreArchivo?: string
  // básicos de consulta
  url: string
  host?: string
  ambiente?: string
  codGen: string
  fechaEmi?: string
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
  // 🔽 campos que inyecta el backend desde el JSON
  emisorNit?: string
  emisorNrc?: string
  emisorNombre?: string
  emisorCodActividad?: string
  emisorDescActividad?: string
  emisorNombreComercial?: string
  emisorTelefono?: string
  emisorCorreo?: string

  receptorNit?: string
  receptorNrc?: string
  receptorNombre?: string
  receptorCodActividad?: string
  receptorDescActividad?: string
  receptorDepartamento?: string
  receptorMunicipio?: string
  receptorComplemento?: string
  receptorTelefono?: string
  receptorCorreo?: string
  receptorNombreComercial?: string
}

type LimitCheck = {
  allowed: boolean
  error?: string
  limit: number | null
  batchLimit?: number | null
  used: number
  incomingRecords: number
  remaining: number | null
}

const INTERNAL_JSON_UPLOAD_CHUNK = 25

function chunkFiles(files: File[], size: number) {
  const chunks: File[][] = []
  for (let i = 0; i < files.length; i += size) {
    chunks.push(files.slice(i, i + size))
  }
  return chunks
}

export default function Page() {
  const { appUser, firebaseUser } = useAuth()
  const createdBy =
    appUser?.displayName || appUser?.email || firebaseUser?.displayName || firebaseUser?.email || 'Usuario'
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Resultado[]>([])
  const [downloadHref, setDownloadHref] = useState<string | null>(null)
  const [filename, setFilename] = useState('verificacion_json.xlsx')
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

  useUploadVerifierTourResultsReady(
    VERIFICADOR_JSON_TOUR_ID,
    resultsVisible && data.length > 0,
  )

  useEffect(() => {
    let cancelled = false

    async function checkSelectedFiles() {
      setLimitCheck(null)
      if (!selectedFiles.length || !firebaseUser) return

      setCheckingLimit(true)
      try {
        const token = await (firebaseUser || auth.currentUser)?.getIdToken()
        if (!token) throw new Error('No autorizado')
        const res = await fetch('/api/usage-limits/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            routeKey: 'verificadorjson',
            incomingRecords: selectedFiles.length,
          }),
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
            incomingRecords: selectedFiles.length,
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
  }, [firebaseUser, selectedFiles])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedFiles.length === 0) {
      toast.warning('Selecciona uno o mas archivos .json')
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
    let processedResults: Resultado[] = []
    let processingError: string | null = null

    try {
      const batches = chunkFiles(selectedFiles, INTERNAL_JSON_UPLOAD_CHUNK)
      const allResults: Resultado[] = []

      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index]

        const fd = new FormData()
        fd.append('routeKey', 'verificadorjson')
        batch.forEach((f) => fd.append('files', f))

        const token = await (firebaseUser || auth.currentUser)?.getIdToken()
        if (!token) throw new Error('No autorizado')

        const res = await fetch('/api/verificararchjson', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(txt || `Error al procesar el lote ${index + 1}`)
        }

        const json = await res.json() as { resultados: Resultado[] }
        allResults.push(...(json.resultados || []))
        processedResults = [...allResults]
        setData([...allResults])
      }

      const exportRes = await fetch('/api/verificararchjson/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultados: allResults }),
      })

      if (!exportRes.ok) {
        const data = await exportRes.json().catch(() => null) as { error?: string } | null
        throw new Error(data?.error || 'No se pudo generar el Excel final')
      }

      const exportJson = await exportRes.json() as {
        filename?: string
        downloadUrl?: string
        excelBase64?: string
      }

      setData(allResults)
      accordionApiRef.current?.setProcessingSummary(
        summarizeDteUploadResults(allResults)
      )
      setFilename(exportJson.filename || 'verificacion_json.xlsx')

      if (exportJson.downloadUrl) {
        setDownloadHref(exportJson.downloadUrl)
      } else if (exportJson.excelBase64) {
        const href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${exportJson.excelBase64}`
        setDownloadHref(href)
      }

      toast.success(
        `Procesamiento finalizado. Se procesaron ${allResults.length} resultado${allResults.length === 1 ? '' : 's'}. Revisa la tabla y descarga el Excel.`
      )
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error inesperado'
      processingError = message
      toast.error(message)
    } finally {
      const summary = processedResults.length
        ? summarizeResults(processedResults)
        : {
            totalRecords: 0,
            successCount: 0,
            errorCount: selectedFiles.length,
            statusBreakdown: { ERROR: selectedFiles.length },
            outcome: 'error' as const,
          }

      await recordProcessingLog({
        routeKey: 'verificadorjson',
        moduleName: 'Verificador JSON',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: summarizeFiles(selectedFiles),
        ...summary,
        errorMessage: processingError || undefined,
      })

      setLoading(false)
    }
  }
  // columnas de la tabla (incluye emisor/receptor)
  const columnas = useMemo(() => ([
    { key: 'nombreArchivo', label: 'Archivo' },
    // Identificación / estado
    { key: 'codGen', label: 'Código Generación' },
    { key: 'fechaEmi', label: 'Fecha Emi.' },
    { key: 'estado', label: 'Estado' },
    { key: 'descripcionEstado', label: 'Descripción Estado' },
    { key: 'tipoDte', label: 'Tipo DTE' },
    { key: 'numeroControl', label: 'N° Control' },

    // Emisor
    { key: 'emisorNit', label: 'Emisor NIT' },
    { key: 'emisorNrc', label: 'Emisor NRC' },
    { key: 'emisorNombre', label: 'Emisor Nombre' },
    { key: 'emisorNombreComercial', label: 'Emisor Comercial' },
    { key: 'emisorCodActividad', label: 'Emisor Cod. Act.' },
    { key: 'emisorDescActividad', label: 'Emisor Actividad' },
    { key: 'emisorTelefono', label: 'Emisor Tel.' },
    { key: 'emisorCorreo', label: 'Emisor Correo' },

    // Receptor
    { key: 'receptorNit', label: 'Receptor NIT' },
    { key: 'receptorNrc', label: 'Receptor NRC' },
    { key: 'receptorNombre', label: 'Receptor Nombre' },
    { key: 'receptorNombreComercial', label: 'Receptor Comercial' },
    { key: 'receptorCodActividad', label: 'Receptor Cod. Act.' },
    { key: 'receptorDescActividad', label: 'Receptor Actividad' },
    { key: 'receptorTelefono', label: 'Receptor Tel.' },
    { key: 'receptorCorreo', label: 'Receptor Correo' },
    { key: 'receptorDireccion', label: 'Receptor Dirección' }, // <- calculada

    // Totales / error
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

    // Link
    { key: 'visitar', label: 'Visitar' },
  ] as const), [])

  // filtro de búsqueda (incluye emisor/receptor)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(r => {
      const direccion = [r.receptorDepartamento, r.receptorMunicipio, r.receptorComplemento].filter(Boolean).join(' ')
      const campos = [
        r.nombreArchivo, r.codGen, r.fechaEmi, r.estado, r.descripcionEstado, r.tipoDte, r.numeroControl, r.montoTotal,
        r.linkVisita, r.url, r.relacionadosTexto, r.notaCreditoEstado,
        r.notaCreditoCodigoGeneracion, r.notaCreditoFechaGeneracion,
        r.notaCreditoFechaEmi, r.notaCreditoSelloRecepcion,
        r.emisorNit, r.emisorNrc, r.emisorNombre, r.emisorNombreComercial, r.emisorCodActividad, r.emisorDescActividad, r.emisorTelefono, r.emisorCorreo,
        r.receptorNit, r.receptorNrc, r.receptorNombre, r.receptorNombreComercial, r.receptorCodActividad, r.receptorDescActividad, r.receptorTelefono, r.receptorCorreo, direccion
      ]
      return campos.some(v => (v || '').toString().toLowerCase().includes(q))
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
        return 'bg-primary/15 text-primary bg-primary/15 text-primary'
      case 'RECHAZADO':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
      case 'INVALIDADO':
        return 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  return (
    <PlanGate routeKey="verificadorjson">
    <main className="w-full max-w-full space-y-6">
          <form onSubmit={onSubmit} className="overflow-hidden rounded-lg border border-border" data-tour="verificador-upload">
            <UploadFormAccordion
              accordionApiRef={accordionApiRef}
              onResultsReveal={onResultsReveal}
              hasResults={resultsVisible && data.length > 0}
              collapseWhenResults
            >
            <UploadFormSection
              label="Archivos JSON"
              briefHint="JSON con codigoGeneracion y fecEmi"
              submitDataTour="verificador-submit"
              helpContent={
                <>
                  <p>
                    Sube archivos JSON con codigoGeneracion y fecEmi. Se consultara el estado en Hacienda y se mostraran datos de emisor y receptor.
                  </p>
                  <p className="mt-2 text-xs opacity-90">
                    Deben contener identificacion.codigoGeneracion e identificacion.fecEmi
                  </p>
                </>
              }
              files={selectedFiles}
              onFilesChange={setSelectedFiles}
              loading={loading || checkingLimit}
              accept={{ 'application/json': ['.json'] }}
              sidePanel={
                <UploadTableHints>
                  Verifica el estado del documento y contrasta los datos de emisor y receptor extraídos del JSON. Usa el buscador para encontrar códigos, nombres, NIT/NRC o correos.
                </UploadTableHints>
              }
            />

            </UploadFormAccordion>
          </form>

          {(limitCheck?.limit !== null && limitCheck?.limit !== undefined) ||
          (limitCheck?.batchLimit !== null && limitCheck?.batchLimit !== undefined) ? (
            <div className={`rounded-md border px-4 py-3 text-sm ${limitCheck?.allowed ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'}`}>
              {limitCheck?.allowed ? (
                <>
                  {limitCheck.batchLimit !== null && limitCheck.batchLimit !== undefined ? (
                    <p>Maximo por proceso: {limitCheck.incomingRecords} de {limitCheck.batchLimit} archivos.</p>
                  ) : null}
                  {limitCheck.limit !== null && limitCheck.limit !== undefined ? (
                    <p>
                      Uso mensual: {limitCheck.incomingRecords} en este proceso. Llevas {limitCheck.used} de {limitCheck.limit}; te quedaran {limitCheck.remaining}.
                    </p>
                  ) : null}
                </>
              ) : (
                limitCheck?.error || 'La seleccion supera el limite configurado para este modulo.'
              )}
            </div>
          ) : null}

          <UploadResultsReveal visible={resultsVisible && data.length > 0}>
          <UploadTableToolbar
            resultCount={{ filtered: filtered.length, total: data.length }}
            exportDataTour="verificador-export"
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
                    buildExportFilename('verificacion_json', 'csv')
                  ),
              },
              pdf: {
                onClick: () =>
                  exportPdfByProfile(
                    data as Record<string, unknown>[],
                    'verificador',
                    buildExportFilename('verificacion_json', 'pdf'),
                    {
                      title: 'Reporte de verificacion JSON',
                      createdBy,
                    }
                  ),
              },
            }}
            filters={{
              dataTour: 'verificador-filters',
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
                  searchPlaceholder="Buscar por código, estado, emisor, receptor…"
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
          <div data-tour="verificador-results-table" className="overflow-hidden rounded-md border border-border">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-muted/50 text-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/40">
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
                        const isEstado = col.key === 'estado' || col.key === 'notaCreditoEstado'
                        const isVisitar = col.key === 'visitar'
                        const isNotaCreditoLink = col.key === 'notaCreditoLinkVisita'
                        const isBool = col.key === 'tieneNotaCredito'
                        const isDireccion = col.key === 'receptorDireccion'
                        const isLongText = col.key === 'relacionadosTexto' || col.key === 'descripcionEstado'
                        const v = isDireccion
                          ? [r.receptorDepartamento, r.receptorMunicipio, r.receptorComplemento].filter(Boolean).join(' / ')
                          : (r as Record<string, unknown>)[col.key] ?? ''

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

            {/* Paginador */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-background px-3 py-2 sm:flex-row">
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
