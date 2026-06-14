'use client'

import PlanGate from '@/components/PlanGate'
import UploadFormSection from '@/components/upload/UploadFormSection'
import ImportFromMailButton from '@/components/upload/ImportFromMailButton'
import UploadFormAccordion from '@/components/upload/UploadFormAccordion'
import UploadResultsReveal from '@/components/upload/UploadResultsReveal'
import UploadTableToolbar from '@/components/upload/UploadTableToolbar'
import UploadTableBasicFilters, { countBasicFilters } from '@/components/upload/UploadTableBasicFilters'
import {
  buildExportFilename,
  exportPdfByProfile,
  exportRowsToCsv,
} from '@/lib/upload-table-export'
import { useUploadResultsReveal } from '@/components/upload/useUploadResultsReveal'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { recordProcessingLog } from '@/lib/client-processing-log'
import { summarizeFiles } from '@/lib/processing-log'
import { summarizeDteUploadResults } from '@/lib/upload-dte-stats'
import {
  extractEmisor,
  extractIdentificacion,
  extractLibroParties,
  extractResumenMontos,
  extractSelloFromJson,
} from '@/lib/dte-json-fields'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { toast } from 'sonner'

type CompraResultado = {
  Generacion: string
  NumeroControl: string
  Fecha: string
  FechaISO: string
  EmisorNIT: string
  EmisorNRC: string
  EmisorNombre: string
  ReceptorNIT: string
  ReceptorNRC: string
  ReceptorNombre: string
  NIT: string
  NRC: string
  Contribuyente: string
  TipoDte: string
  TipoDocumento: string
  Exenta: number
  MontoGravado: number
  IVA: number
  Percepcion: number
  TotalPagar: number
  SelloRecibido: string
  Archivo: string
  Error?: string
}

type ColumnKey = keyof CompraResultado

export default function ComprasJsonPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CompraResultado[]>([])
  const [search, setSearch] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const {
    resultsVisible,
    accordionApiRef,
    resetResultsVisibility,
    onResultsReveal,
  } = useUploadResultsReveal()

  const fmt = (value: number) =>
    Number(value || 0).toLocaleString('es-SV', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    })

  const formatDate = (date?: string) => {
    if (!date || !date.includes('-')) return ''
    const [y, m, d] = date.split('-')
    return `${d}/${m}/${y}`
  }

  const tipoDocumento = (tipoDte: string) => {
    switch (tipoDte) {
      case '01':
        return 'Factura'
      case '03':
        return 'Crédito Fiscal'
      case '05':
        return 'Nota de Crédito'
      default:
        return 'Otro'
    }
  }

  const procesarArchivo = async (file: File): Promise<CompraResultado> => {
    try {
      const obj = JSON.parse(await file.text()) as Record<string, unknown>

      const identificacion = extractIdentificacion(obj)
      const emisor = extractEmisor(obj)
      const parties = extractLibroParties(obj)
      const montos = extractResumenMontos(obj)
      const selloRecibido = extractSelloFromJson(obj)

      const tipoDte = identificacion.tipoDte
      const fechaISO = identificacion.fechaISO

      return {
        Generacion: identificacion.generacion,
        NumeroControl: identificacion.numeroControl,
        Fecha: formatDate(fechaISO),
        FechaISO: fechaISO,
        EmisorNIT: parties.EmisorNIT,
        EmisorNRC: parties.EmisorNRC,
        EmisorNombre: parties.EmisorNombre,
        ReceptorNIT: parties.ReceptorNIT,
        ReceptorNRC: parties.ReceptorNRC,
        ReceptorNombre: parties.ReceptorNombre,
        NIT: emisor.nit,
        NRC: emisor.nrc,
        Contribuyente: emisor.nombre,
        TipoDte: tipoDte,
        TipoDocumento: tipoDocumento(tipoDte),
        Exenta: montos.exenta,
        MontoGravado: montos.gravada,
        IVA: montos.iva,
        Percepcion: montos.percepcion,
        TotalPagar: montos.totalPagar,
        SelloRecibido: selloRecibido,
        Archivo: file.name,
        Error: '',
      }
    } catch {
      return {
        Generacion: '',
        NumeroControl: '',
        Fecha: '',
        FechaISO: '',
        EmisorNIT: '',
        EmisorNRC: '',
        EmisorNombre: '',
        ReceptorNIT: '',
        ReceptorNRC: '',
        ReceptorNombre: '',
        NIT: '',
        NRC: '',
        Contribuyente: '',
        TipoDte: '',
        TipoDocumento: '',
        Exenta: 0,
        MontoGravado: 0,
        IVA: 0,
        Percepcion: 0,
        TotalPagar: 0,
        SelloRecibido: '',
        Archivo: file.name,
        Error: 'JSON inválido',
      }
    }
  }

  const exportExcel = (rows: CompraResultado[]) => {
    if (!rows.length) {
      toast.error('No hay datos para exportar.')
      return
    }

    const validRows = rows.filter((r) => !r.Error)
    const errores = rows.filter((r) => r.Error)

    if (!validRows.length && errores.length) {
      toast.error('No hay registros válidos para exportar.')
      return
    }

    const wb = XLSX.utils.book_new()

    const wsCompras = XLSX.utils.json_to_sheet(validRows)
    XLSX.utils.book_append_sheet(wb, wsCompras, 'Compras')

    const resumenDiario = Object.values(
      validRows.reduce<Record<string, {
        Fecha: string
        Exenta: number
        MontoGravado: number
        IVA: number
        Percepcion: number
        TotalPagar: number
        Registros: number
      }>>((acc, row) => {
        const key = row.Fecha || 'SIN FECHA'

        if (!acc[key]) {
          acc[key] = {
            Fecha: row.Fecha,
            Exenta: 0,
            MontoGravado: 0,
            IVA: 0,
            Percepcion: 0,
            TotalPagar: 0,
            Registros: 0,
          }
        }

        acc[key].Exenta += row.Exenta
        acc[key].MontoGravado += row.MontoGravado
        acc[key].IVA += row.IVA
        acc[key].Percepcion += row.Percepcion
        acc[key].TotalPagar += row.TotalPagar
        acc[key].Registros += 1

        return acc
      }, {})
    )

    const wsResumenDiario = XLSX.utils.json_to_sheet(resumenDiario)
    XLSX.utils.book_append_sheet(wb, wsResumenDiario, 'Resumen Diario')

    const resumenProveedor = Object.values(
      validRows.reduce<Record<string, {
        NIT: string
        NRC: string
        Contribuyente: string
        Exenta: number
        MontoGravado: number
        IVA: number
        Percepcion: number
        TotalPagar: number
        Registros: number
      }>>((acc, row) => {
        const key = row.EmisorNRC || row.EmisorNIT || row.EmisorNombre || 'SIN PROVEEDOR'

        if (!acc[key]) {
          acc[key] = {
            NIT: row.EmisorNIT,
            NRC: row.EmisorNRC,
            Contribuyente: row.EmisorNombre,
            Exenta: 0,
            MontoGravado: 0,
            IVA: 0,
            Percepcion: 0,
            TotalPagar: 0,
            Registros: 0,
          }
        }

        acc[key].Exenta += row.Exenta
        acc[key].MontoGravado += row.MontoGravado
        acc[key].IVA += row.IVA
        acc[key].Percepcion += row.Percepcion
        acc[key].TotalPagar += row.TotalPagar
        acc[key].Registros += 1

        return acc
      }, {})
    )

    const wsResumenProveedor = XLSX.utils.json_to_sheet(resumenProveedor)
    XLSX.utils.book_append_sheet(wb, wsResumenProveedor, 'Resumen Proveedor')

    if (errores.length) {
      const wsErrores = XLSX.utils.json_to_sheet(errores)
      XLSX.utils.book_append_sheet(wb, wsErrores, 'Errores')
    }

    XLSX.writeFile(
      wb,
      `compras_json_${new Date().toISOString().slice(0, 10)}.xlsx`
    )
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedFiles.length === 0) {
      toast.warning('Selecciona uno o más archivos .json')
      return
    }

    setLoading(true)
    resetResultsVisibility()
    setData([])
    setCurrentPage(1)
    const startedAt = new Date()
    const started = performance.now()

    try {
      const resultados = await Promise.all(
        selectedFiles.map((file) => procesarArchivo(file))
      )

      resultados.sort((a, b) => {
        const da = a.FechaISO ? new Date(a.FechaISO).getTime() : 0
        const db = b.FechaISO ? new Date(b.FechaISO).getTime() : 0
        return da - db
      })

      setData(resultados)
      accordionApiRef.current?.setProcessingSummary(
        summarizeDteUploadResults(resultados)
      )

      const successCount = resultados.filter((r) => !r.Error).length
      const errorCount = resultados.filter((r) => r.Error).length

      toast.success(
        errorCount > 0
          ? `Procesamiento finalizado con ${errorCount} error(es).`
          : 'Procesamiento finalizado.'
      )

      await recordProcessingLog({
        routeKey: 'compras-json',
        moduleName: 'Procesador Compras JSON',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: summarizeFiles(selectedFiles),
        totalRecords: resultados.length,
        successCount,
        errorCount,
        statusBreakdown: {
          PROCESADO: successCount,
          ERROR: errorCount,
        },
        outcome: errorCount > 0 ? 'error' : 'success',
      })
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Error inesperado'

      toast.error(message)

      await recordProcessingLog({
        routeKey: 'compras-json',
        moduleName: 'Procesador Compras JSON',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: summarizeFiles(selectedFiles),
        totalRecords: 0,
        successCount: 0,
        errorCount: selectedFiles.length,
        statusBreakdown: { ERROR: selectedFiles.length },
        outcome: 'error',
        errorMessage: message,
      })
    } finally {
      setLoading(false)
    }
  }

  const columnas = useMemo(
    () =>
      [
        { key: 'Generacion', label: 'Código Generación' },
        { key: 'NumeroControl', label: 'N° Control' },
        { key: 'Fecha', label: 'Fecha' },
        { key: 'EmisorNIT', label: 'Emisor NIT' },
        { key: 'EmisorNRC', label: 'Emisor NRC' },
        { key: 'EmisorNombre', label: 'Emisor' },
        { key: 'ReceptorNIT', label: 'Receptor NIT' },
        { key: 'ReceptorNRC', label: 'Receptor NRC' },
        { key: 'ReceptorNombre', label: 'Receptor' },
        { key: 'TipoDte', label: 'Tipo DTE' },
        { key: 'TipoDocumento', label: 'Documento' },
        { key: 'Exenta', label: 'Exenta' },
        { key: 'MontoGravado', label: 'Gravado' },
        { key: 'IVA', label: 'IVA' },
        { key: 'Percepcion', label: 'Percepción' },
        { key: 'TotalPagar', label: 'Total Pagar' },
        { key: 'SelloRecibido', label: 'Sello Recibido' },
        { key: 'Archivo', label: 'Archivo' },
      ] satisfies Array<{ key: ColumnKey; label: string }>,
    []
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data

    return data.filter((r) =>
      [
        r.Generacion,
        r.NumeroControl,
        r.Fecha,
        r.EmisorNIT,
        r.EmisorNRC,
        r.EmisorNombre,
        r.ReceptorNIT,
        r.ReceptorNRC,
        r.ReceptorNombre,
        r.TipoDte,
        r.TipoDocumento,
        r.SelloRecibido,
        r.Archivo,
        r.Error,
      ].some((v) => String(v || '').toLowerCase().includes(q))
    )
  }, [data, search])

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

  const resumen = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.exenta += Number(r.Exenta || 0)
        acc.gravado += Number(r.MontoGravado || 0)
        acc.iva += Number(r.IVA || 0)
        acc.percepcion += Number(r.Percepcion || 0)
        acc.total += Number(r.TotalPagar || 0)
        return acc
      },
      {
        exenta: 0,
        gravado: 0,
        iva: 0,
        percepcion: 0,
        total: 0,
      }
    )
  }, [filtered])

  const tipoDtePill = (v?: string) => {
    switch (v) {
      case '01':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
      case '03':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
      case '05':
        return 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  const renderValue = (row: CompraResultado, key: ColumnKey) => {
    const value = row[key]

    const isMoney =
      key === 'Exenta' ||
      key === 'MontoGravado' ||
      key === 'IVA' ||
      key === 'Percepcion' ||
      key === 'TotalPagar'

    if (key === 'TipoDte') {
      return (
        <span
          className={`px-2 py-0.5 rounded-full text-xs ${tipoDtePill(
            String(value)
          )}`}
        >
          {String(value || '')}
        </span>
      )
    }

    if (isMoney) return fmt(Number(value || 0))

    return String(value || '')
  }

  return (
    <PlanGate routeKey="compras-json">
      <main className="w-full max-w-full space-y-6 dark:bg-background">
            <form
              onSubmit={onSubmit}
              className="overflow-hidden rounded-lg border border-border"
            >
              <UploadFormAccordion
                accordionApiRef={accordionApiRef}
                onResultsReveal={onResultsReveal}
                hasResults={resultsVisible && data.length > 0}
                collapseWhenResults
              >
              <UploadFormSection
                label="Archivos JSON"
                briefHint="DTE en JSON"
                helpContent="Sube documentos DTE en formato JSON para generar el libro de compras, resumen diario y resumen por proveedor."
                files={selectedFiles}
                onFilesChange={setSelectedFiles}
                loading={loading}
                accept={{ 'application/json': ['.json'] }}
                labelActions={
                  <ImportFromMailButton
                    tiposDte={['01', '03', '05']}
                    disabled={loading}
                    onImport={(files) => setSelectedFiles((prev) => [...prev, ...files])}
                  />
                }
              />

              </UploadFormAccordion>
            </form>

            <UploadResultsReveal visible={resultsVisible && data.length > 0}>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-slate-500 text-muted-foreground">
                  Exenta
                </p>
                <p className="font-bold text-foreground">
                  {fmt(resumen.exenta)}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-slate-500 text-muted-foreground">
                  Gravado
                </p>
                <p className="font-bold text-foreground">
                  {fmt(resumen.gravado)}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-slate-500 text-muted-foreground">IVA</p>
                <p className="font-bold text-foreground">
                  {fmt(resumen.iva)}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-slate-500 text-muted-foreground">
                  Percepción
                </p>
                <p className="font-bold text-foreground">
                  {fmt(resumen.percepcion)}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-slate-500 text-muted-foreground">
                  Total pagar
                </p>
                <p className="font-bold text-foreground">
                  {fmt(resumen.total)}
                </p>
              </div>
            </section>

            <UploadTableToolbar
              resultCount={{ filtered: filtered.length, total: data.length }}
              export={{
                excel: {
                  onClick: () => exportExcel(data),
                  label: 'EXCEL',
                },
                csv: {
                  onClick: () =>
                    exportRowsToCsv(
                      data as Record<string, unknown>[],
                      buildExportFilename('compras_json', 'csv')
                    ),
                },
                pdf: {
                  onClick: () =>
                    exportPdfByProfile(
                      data as Record<string, unknown>[],
                      'compras',
                      buildExportFilename('compras_json', 'pdf')
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
                    searchPlaceholder="Buscar por código, NRC, proveedor…"
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(value) => {
                      setRowsPerPage(value)
                      setCurrentPage(1)
                    }}
                  />
                ),
              }}
            />

            <div className="overflow-hidden rounded-md border border-border">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-950 bg-card dark:text-zinc-100">
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
                    {paginatedData.length === 0 && (
                      <tr>
                        <td
                          colSpan={columnas.length}
                          className="p-6 text-center text-muted-foreground"
                        >
                          {loading
                            ? 'Cargando…'
                            : 'Sin resultados para mostrar.'}
                        </td>
                      </tr>
                    )}

                    {paginatedData.map((r, i) => (
                      <tr
                        key={r.Generacion || r.NumeroControl || r.Archivo || i}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        {columnas.map((col) => (
                          <td
                            key={col.key}
                            className="p-2 align-top whitespace-nowrap"
                          >
                            {renderValue(r, col.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-background px-3 py-2 sm:flex-row">
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
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
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