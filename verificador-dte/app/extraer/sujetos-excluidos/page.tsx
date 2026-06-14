'use client'

import PlanGate from '@/components/PlanGate'
import UploadFormSection from '@/components/upload/UploadFormSection'
import ImportFromMailButton from '@/components/upload/ImportFromMailButton'
import UploadFormAccordion from '@/components/upload/UploadFormAccordion'
import UploadResultsReveal from '@/components/upload/UploadResultsReveal'
import UploadTableToolbar from '@/components/upload/UploadTableToolbar'
import UploadTableBasicFilters, { countBasicFilters } from '@/components/upload/UploadTableBasicFilters'
import UploadTableDateRangeFilters, {
  countDateRangeFilters,
} from '@/components/upload/UploadTableDateRangeFilters'
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
import {
  extractIdentificacion,
  extractSelloFromJson,
} from '@/lib/dte-json-fields'
import { summarizeDteUploadResults } from '@/lib/upload-dte-stats'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
  ArrowUpDown,
} from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { toast } from 'sonner'

type SujetoExcluidoResultado = {
  NumeroControl: string
  CodigoGeneracion: string
  Fecha: string
  FechaISO: string
  NumDocumento: string
  Nombre: string
  Descripcion: string
  PrecioUni: number
  MontoDescu: number
  Compra: number
  SubTotal: number
  ReteRenta: number
  TotalPagar: number
  SelloRecibido: string
  Archivo: string
  Error?: string
}

type ColumnKey = keyof SujetoExcluidoResultado

const ROWS_OPTIONS = [10, 20, 50, 100]

export default function SujetosExcluidosPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SujetoExcluidoResultado[]>([])
  const [search, setSearch] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const {
    resultsVisible,
    accordionApiRef,
    resetResultsVisibility,
    onResultsReveal,
  } = useUploadResultsReveal()
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )

  const [sortState, setSortState] = useState<{
    key: ColumnKey
    direction: 'asc' | 'desc'
  }>({
    key: 'FechaISO',
    direction: 'asc',
  })

  const fmt = (value: number) =>
    Number(value || 0).toLocaleString('es-SV', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    })

  const toNumber = (value: unknown) => {
    const n = Number(value ?? 0)
    return Number.isFinite(n) ? n : 0
  }

  const formatDate = (date?: string) => {
    if (!date || !date.includes('-')) return ''
    const [y, m, d] = date.split('-')
    return `${d}/${m}/${y}`
  }

  const procesarArchivo = async (
    file: File
  ): Promise<SujetoExcluidoResultado | null> => {
    try {
      const text = await file.text()
      const clean = text.startsWith('data:')
        ? text.split(',').slice(1).join(',')
        : text

      const obj = JSON.parse(clean) as Record<string, unknown>

      const identificacion = extractIdentificacion(obj)
      const sujetoExcluido = (obj?.sujetoExcluido || {}) as Record<string, unknown>
      const resumen = (obj?.resumen || {}) as Record<string, unknown>
      const cuerpoDocumento = Array.isArray(obj?.cuerpoDocumento)
        ? obj.cuerpoDocumento
        : []

      const tipoDte = identificacion.tipoDte

      if (tipoDte !== '14') {
        return null
      }

      const primerDetalle = (cuerpoDocumento[0] || {}) as Record<string, unknown>
      const fechaISO = identificacion.fechaISO
      const selloRecibido = extractSelloFromJson(obj)

      return {
        NumeroControl: identificacion.numeroControl,
        CodigoGeneracion: identificacion.generacion,
        Fecha: formatDate(fechaISO),
        FechaISO: fechaISO,
        NumDocumento: String(sujetoExcluido?.numDocumento || ''),
        Nombre: String(sujetoExcluido?.nombre || '').toUpperCase(),
        Descripcion: String(primerDetalle?.descripcion || ''),
        PrecioUni: toNumber(primerDetalle?.precioUni),
        MontoDescu: toNumber(primerDetalle?.montoDescu),
        Compra: toNumber(resumen?.totalCompra),
        SubTotal: toNumber(resumen?.subTotal || resumen?.subtotal),
        ReteRenta: toNumber(resumen?.reteRenta),
        TotalPagar: toNumber(resumen?.totalPagar),
        SelloRecibido: selloRecibido,
        Archivo: file.name,
        Error: '',
      }
    } catch {
      return {
        NumeroControl: '',
        CodigoGeneracion: '',
        Fecha: '',
        FechaISO: '',
        NumDocumento: '',
        Nombre: '',
        Descripcion: '',
        PrecioUni: 0,
        MontoDescu: 0,
        Compra: 0,
        SubTotal: 0,
        ReteRenta: 0,
        TotalPagar: 0,
        SelloRecibido: '',
        Archivo: file.name,
        Error: 'JSON inválido',
      }
    }
  }

  const columnas = useMemo(
    () =>
      [
        { key: 'NumeroControl', label: 'N° Control' },
        { key: 'CodigoGeneracion', label: 'Código Generación' },
        { key: 'Fecha', label: 'Fecha' },
        { key: 'NumDocumento', label: 'Documento' },
        { key: 'Nombre', label: 'Nombre' },
        { key: 'Descripcion', label: 'Descripción' },
        { key: 'PrecioUni', label: 'Precio U.' },
        { key: 'MontoDescu', label: 'Monto Desc.' },
        { key: 'Compra', label: 'Compra' },
        { key: 'SubTotal', label: 'Subtotal' },
        { key: 'ReteRenta', label: 'Rete Renta' },
        { key: 'TotalPagar', label: 'Total a pagar' },
        { key: 'SelloRecibido', label: 'Sello' },
        { key: 'Archivo', label: 'Archivo' },
      ] satisfies Array<{ key: ColumnKey; label: string }>,
    []
  )

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

      const registros = resultados.filter(
        (item): item is SujetoExcluidoResultado => Boolean(item)
      )

      registros.sort((a, b) => {
        const da = a.FechaISO ? new Date(a.FechaISO).getTime() : 0
        const db = b.FechaISO ? new Date(b.FechaISO).getTime() : 0
        return da - db
      })

      setData(registros)
      accordionApiRef.current?.setProcessingSummary(
        summarizeDteUploadResults(registros)
      )

      const successCount = registros.filter((r) => !r.Error).length
      const errorCount = registros.filter((r) => r.Error).length
      const ignoredCount = resultados.filter((r) => r === null).length

      toast.success(
        ignoredCount > 0
          ? `Procesamiento finalizado. ${ignoredCount} archivo(s) ignorado(s) porque no eran DTE tipo 14.`
          : errorCount > 0
            ? `Procesamiento finalizado con ${errorCount} error(es).`
            : 'Procesamiento finalizado.'
      )

      await recordProcessingLog({
        routeKey: 'sujetos-excluidos',
        moduleName: 'Procesador Sujetos Excluidos JSON',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: summarizeFiles(selectedFiles),
        totalRecords: registros.length,
        successCount,
        errorCount,
        statusBreakdown: {
          PROCESADO: successCount,
          ERROR: errorCount,
          IGNORADO: ignoredCount,
        },
        outcome: errorCount > 0 ? 'error' : 'success',
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error inesperado'

      toast.error(message)

      await recordProcessingLog({
        routeKey: 'sujetos-excluidos',
        moduleName: 'Procesador Sujetos Excluidos JSON',
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return data.filter((r) => {
      const matchSearch =
        !q ||
        [
          r.NumeroControl,
          r.CodigoGeneracion,
          r.Fecha,
          r.NumDocumento,
          r.Nombre,
          r.Descripcion,
          r.SelloRecibido,
          r.Archivo,
          r.Error,
        ].some((v) => String(v || '').toLowerCase().includes(q))

      const matchFrom = !filterFrom || r.FechaISO >= filterFrom
      const matchTo = !filterTo || r.FechaISO <= filterTo

      return matchSearch && matchFrom && matchTo
    })
  }, [data, search, filterFrom, filterTo])

  const sortedData = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const key = sortState.key

      const aValue = a[key]
      const bValue = b[key]

      const direction = sortState.direction === 'asc' ? 1 : -1

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction
      }

      return String(aValue || '').localeCompare(String(bValue || '')) * direction
    })
  }, [filtered, sortState])

  const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage))

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [sortedData.length, rowsPerPage, totalPages, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterFrom, filterTo])

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return sortedData.slice(start, start + rowsPerPage)
  }, [sortedData, currentPage, rowsPerPage])

  const resumen = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.compra += Number(r.Compra || 0)
        acc.subtotal += Number(r.SubTotal || 0)
        acc.reteRenta += Number(r.ReteRenta || 0)
        acc.total += Number(r.TotalPagar || 0)
        acc.descuento += Number(r.MontoDescu || 0)
        return acc
      },
      {
        compra: 0,
        subtotal: 0,
        reteRenta: 0,
        total: 0,
        descuento: 0,
      }
    )
  }, [filtered])

  const renderValue = (row: SujetoExcluidoResultado, key: ColumnKey) => {
    const value = row[key]

    const isMoney =
      key === 'PrecioUni' ||
      key === 'MontoDescu' ||
      key === 'Compra' ||
      key === 'SubTotal' ||
      key === 'ReteRenta' ||
      key === 'TotalPagar'

    if (isMoney) return fmt(Number(value || 0))

    return String(value || '')
  }

  const handleSort = (key: ColumnKey) => {
    setSortState((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const exportExcel = (rows: SujetoExcluidoResultado[]) => {
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

    const detalle = validRows.map((r) => ({
      'No. Control': r.NumeroControl,
      'Código Generación': r.CodigoGeneracion,
      Fecha: r.Fecha,
      Documento: r.NumDocumento,
      Nombre: r.Nombre,
      Descripción: r.Descripcion,
      'Precio U.': r.PrecioUni,
      'Monto Desc.': r.MontoDescu,
      Compra: r.Compra,
      Subtotal: r.SubTotal,
      'Rete Renta': r.ReteRenta,
      'Total a pagar': r.TotalPagar,
      Sello: r.SelloRecibido,
      Archivo: r.Archivo,
    }))

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(detalle),
      'Sujetos Excluidos'
    )

    const resumenDiario = Object.values(
      validRows.reduce<
        Record<
          string,
          {
            Fecha: string
            Compra: number
            SubTotal: number
            ReteRenta: number
            TotalPagar: number
            Registros: number
          }
        >
      >((acc, row) => {
        const key = row.Fecha || 'SIN FECHA'

        if (!acc[key]) {
          acc[key] = {
            Fecha: row.Fecha,
            Compra: 0,
            SubTotal: 0,
            ReteRenta: 0,
            TotalPagar: 0,
            Registros: 0,
          }
        }

        acc[key].Compra += row.Compra
        acc[key].SubTotal += row.SubTotal
        acc[key].ReteRenta += row.ReteRenta
        acc[key].TotalPagar += row.TotalPagar
        acc[key].Registros += 1

        return acc
      }, {})
    )

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(resumenDiario),
      'Resumen Diario'
    )

    const resumenSujeto = Object.values(
      validRows.reduce<
        Record<
          string,
          {
            Documento: string
            Nombre: string
            Compra: number
            SubTotal: number
            ReteRenta: number
            TotalPagar: number
            Registros: number
          }
        >
      >((acc, row) => {
        const key = row.NumDocumento || row.Nombre || 'SIN SUJETO'

        if (!acc[key]) {
          acc[key] = {
            Documento: row.NumDocumento,
            Nombre: row.Nombre,
            Compra: 0,
            SubTotal: 0,
            ReteRenta: 0,
            TotalPagar: 0,
            Registros: 0,
          }
        }

        acc[key].Compra += row.Compra
        acc[key].SubTotal += row.SubTotal
        acc[key].ReteRenta += row.ReteRenta
        acc[key].TotalPagar += row.TotalPagar
        acc[key].Registros += 1

        return acc
      }, {})
    )

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(resumenSujeto),
      'Resumen por Sujeto'
    )

    if (errores.length) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(errores),
        'Errores'
      )
    }

    XLSX.writeFile(
      wb,
      `sujetos_excluidos_${new Date().toISOString().slice(0, 10)}.xlsx`
    )
  }

  const clearAll = () => {
    resetResultsVisibility()
    setData([])
    setSearch('')
    setCurrentPage(1)
    setFilterFrom('')
    setFilterTo(new Date().toISOString().slice(0, 10))
    setSortState({
      key: 'FechaISO',
      direction: 'asc',
    })

    setSelectedFiles([])
  }

  return (
    <PlanGate routeKey="sujetos-excluidos">
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
                briefHint="Solo tipo DTE 14"
                helpContent={
                  <>
                    <p>
                      Sube documentos DTE tipo 14 para generar el detalle, resumen diario y resumen por sujeto excluido.
                    </p>
                    <p className="mt-2 text-xs opacity-90">Solo se procesaran documentos con tipoDte 14.</p>
                  </>
                }
                files={selectedFiles}
                onFilesChange={setSelectedFiles}
                loading={loading}
                accept={{ 'application/json': ['.json'] }}
                labelActions={
                  <ImportFromMailButton
                    tiposDte={['14']}
                    disabled={loading}
                    onImport={(files) => setSelectedFiles((prev) => [...prev, ...files])}
                  />
                }
              >
                {data.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearAll}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="mr-2 size-4" />
                    Limpiar
                  </Button>
                )}
              </UploadFormSection>

              </UploadFormAccordion>
            </form>

            <UploadResultsReveal visible={resultsVisible && data.length > 0}>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-slate-500 text-muted-foreground">
                  Compra
                </p>
                <p className="font-bold text-foreground">
                  {fmt(resumen.compra)}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-slate-500 text-muted-foreground">
                  Subtotal
                </p>
                <p className="font-bold text-foreground">
                  {fmt(resumen.subtotal)}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-slate-500 text-muted-foreground">
                  Retención renta
                </p>
                <p className="font-bold text-foreground">
                  {fmt(resumen.reteRenta)}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-slate-500 text-muted-foreground">
                  Descuento
                </p>
                <p className="font-bold text-foreground">
                  {fmt(resumen.descuento)}
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
              resultCount={{ filtered: sortedData.length, total: data.length }}
              export={{
                excel: {
                  onClick: () => exportExcel(data),
                  label: 'EXCEL',
                },
                csv: {
                  onClick: () =>
                    exportRowsToCsv(
                      data as Record<string, unknown>[],
                      buildExportFilename('sujetos_excluidos', 'csv')
                    ),
                },
                pdf: {
                  onClick: () =>
                    exportPdfByProfile(
                      data as Record<string, unknown>[],
                      'sujetosExcluidos',
                      buildExportFilename('sujetos_excluidos', 'pdf')
                    ),
                },
              }}
              filters={{
                activeCount:
                  countBasicFilters(search, rowsPerPage) +
                  countDateRangeFilters(
                    filterFrom,
                    filterTo,
                    new Date().toISOString().slice(0, 10)
                  ),
                onClear: () => {
                  setFilterFrom('')
                  setFilterTo(new Date().toISOString().slice(0, 10))
                  setSearch('')
                  setRowsPerPage(10)
                  setCurrentPage(1)
                },
                children: (
                  <>
                    <UploadTableDateRangeFilters
                      filterFrom={filterFrom}
                      filterTo={filterTo}
                      onFromChange={(value) => {
                        setFilterFrom(value)
                        setCurrentPage(1)
                      }}
                      onToChange={(value) => {
                        setFilterTo(value)
                        setCurrentPage(1)
                      }}
                    />
                    <UploadTableBasicFilters
                      search={search}
                      onSearchChange={(value) => {
                        setSearch(value)
                        setCurrentPage(1)
                      }}
                      searchPlaceholder="Buscar por código, documento, nombre…"
                      rowsPerPage={rowsPerPage}
                      onRowsPerPageChange={(value) => {
                        setRowsPerPage(value)
                        setCurrentPage(1)
                      }}
                    />
                  </>
                ),
              }}
            />

            <div className="overflow-hidden rounded-md border border-border">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-border bg-muted/50 text-foreground">
                    <tr>
                      {columnas.map((col) => (
                        <th
                          key={col.key}
                          className="whitespace-nowrap p-2 text-left font-semibold"
                        >
                          <button
                            type="button"
                            onClick={() => handleSort(col.key)}
                            className="inline-flex items-center gap-1 hover:text-primary"
                          >
                            {col.label}
                            <ArrowUpDown className="size-3" />
                          </button>
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
                          {loading ? 'Cargando…' : 'Sin resultados para mostrar.'}
                        </td>
                      </tr>
                    )}

                    {paginatedData.map((r, i) => (
                      <tr
                        key={
                          r.CodigoGeneracion ||
                          r.NumeroControl ||
                          r.Archivo ||
                          i
                        }
                        className="transition-colors hover:bg-muted/40"
                      >
                        {columnas.map((col) => (
                          <td
                            key={col.key}
                            className="whitespace-nowrap p-2 align-top"
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
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
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
  )
}