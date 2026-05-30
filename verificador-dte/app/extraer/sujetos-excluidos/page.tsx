'use client'

import PlanGate from '@/components/PlanGate'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { recordProcessingLog } from '@/lib/client-processing-log'
import { summarizeFiles } from '@/lib/processing-log'
import {
  FileUp,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Trash2,
  ArrowUpDown,
} from 'lucide-react'
import * as XLSX from 'xlsx-js-style'

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
  const inputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [data, setData] = useState<SujetoExcluidoResultado[]>([])
  const [search, setSearch] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
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

      const obj = JSON.parse(clean)

      const identificacion = obj?.identificacion || {}
      const sujetoExcluido = obj?.sujetoExcluido || {}
      const resumen = obj?.resumen || {}
      const cuerpoDocumento = Array.isArray(obj?.cuerpoDocumento)
        ? obj.cuerpoDocumento
        : []

      const tipoDte = String(identificacion?.tipoDte || '')

      if (tipoDte !== '14') {
        return null
      }

      const primerDetalle = cuerpoDocumento[0] || {}
      const fechaISO = String(identificacion?.fecEmi || '')

      const selloRecibido =
        obj?.selloRecibido ||
        obj?.selloRecepcion ||
        obj?.SelloRecibido ||
        obj?.SelloRecepcion ||
        obj?.respuestaHacienda?.selloRecibido ||
        obj?.respuestaHacienda?.selloRecepcion ||
        obj?.responseHacienda?.selloRecibido ||
        obj?.responseHacienda?.selloRecepcion ||
        ''

      return {
        NumeroControl: String(identificacion?.numeroControl || ''),
        CodigoGeneracion: String(identificacion?.codigoGeneracion || ''),
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
        SelloRecibido: String(selloRecibido),
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

    const files = inputRef.current?.files

    if (!files || files.length === 0) {
      setMsg('Selecciona uno o más archivos .json')
      return
    }

    setLoading(true)
    setMsg('Procesando…')
    setData([])
    setCurrentPage(1)

    const selectedFiles = Array.from(files)
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

      const successCount = registros.filter((r) => !r.Error).length
      const errorCount = registros.filter((r) => r.Error).length
      const ignoredCount = resultados.filter((r) => r === null).length

      setMsg(
        ignoredCount > 0
          ? `✅ Procesamiento finalizado. ${ignoredCount} archivo(s) ignorado(s) porque no eran DTE tipo 14.`
          : errorCount > 0
            ? `✅ Procesamiento finalizado con ${errorCount} error(es).`
            : '✅ Procesamiento finalizado.'
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

      setMsg(`❌ ${message}`)

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
      setMsg('❌ No hay datos para exportar.')
      return
    }

    const validRows = rows.filter((r) => !r.Error)
    const errores = rows.filter((r) => r.Error)

    if (!validRows.length && errores.length) {
      setMsg('❌ No hay registros válidos para exportar.')
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
    setData([])
    setSearch('')
    setMsg('')
    setCurrentPage(1)
    setFilterFrom('')
    setFilterTo(new Date().toISOString().slice(0, 10))
    setSortState({
      key: 'FechaISO',
      direction: 'asc',
    })

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <PlanGate routeKey="sujetos-excluidos">
      <main className="w-full max-w-full dark:bg-background">
        <Card className="w-full max-w-full overflow-hidden border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <CardHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-white/10 dark:bg-zinc-950/90 dark:supports-[backdrop-filter]:bg-zinc-950/80">
            <CardTitle className="text-2xl text-slate-950 dark:text-white">
              Procesador de Sujetos Excluidos JSON
            </CardTitle>

            <CardDescription className="text-slate-600 dark:text-zinc-300">
              Sube documentos DTE tipo 14 para generar el detalle, resumen
              diario y resumen por sujeto excluido.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <form
              onSubmit={onSubmit}
              className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black"
            >
              <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="file">Archivos JSON</Label>

                  <Input
                    id="file"
                    ref={inputRef}
                    type="file"
                    accept=".json,application/json"
                    multiple
                  />

                  <p className="text-xs text-muted-foreground">
                    Solo se procesarán documentos con tipoDte 14.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-yellow-400 font-bold text-black hover:bg-yellow-300 sm:w-auto"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Procesando…
                      </>
                    ) : (
                      <>
                        <FileUp className="mr-2 size-4" />
                        Procesar
                      </>
                    )}
                  </Button>

                  {data.length > 0 && (
                    <>
                      <Button
                        type="button"
                        onClick={() => exportExcel(sortedData)}
                        className="w-full bg-yellow-400 font-bold text-black hover:bg-yellow-300 sm:w-auto"
                      >
                        Descargar Excel
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={clearAll}
                        className="w-full sm:w-auto"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Limpiar
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {msg && (
                <div
                  className={`rounded-md p-3 text-sm ${
                    msg.startsWith('✅')
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                      : msg.startsWith('Procesando')
                        ? 'bg-yellow-100 text-yellow-900 dark:bg-yellow-400/15 dark:text-yellow-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                  }`}
                >
                  {msg}
                </div>
              )}
            </form>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Compra
                </p>
                <p className="font-bold text-slate-950 dark:text-white">
                  {fmt(resumen.compra)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Subtotal
                </p>
                <p className="font-bold text-slate-950 dark:text-white">
                  {fmt(resumen.subtotal)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Retención renta
                </p>
                <p className="font-bold text-slate-950 dark:text-white">
                  {fmt(resumen.reteRenta)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Descuento
                </p>
                <p className="font-bold text-slate-950 dark:text-white">
                  {fmt(resumen.descuento)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Total pagar
                </p>
                <p className="font-bold text-slate-950 dark:text-white">
                  {fmt(resumen.total)}
                </p>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="from">Desde</Label>
                  <Input
                    id="from"
                    type="date"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="to">Hasta</Label>
                  <Input
                    id="to"
                    type="date"
                    value={filterTo}
                    onChange={(e) => setFilterTo(e.target.value)}
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setFilterFrom('')
                      setFilterTo(new Date().toISOString().slice(0, 10))
                    }}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            </section>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="hidden sm:inline">Resultados:</span>
                <span className="font-medium text-foreground">
                  {sortedData.length}
                </span>
                {sortedData.length !== data.length && (
                  <span className="text-xs">(de {data.length} totales)</span>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por código, documento, nombre…"
                    className="w-[280px] pl-9"
                  />
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="rpp" className="text-sm">
                    Filas
                  </Label>

                  <select
                    id="rpp"
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    {ROWS_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-slate-200 dark:border-white/10">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-950 dark:bg-zinc-900 dark:text-zinc-100">
                    <tr>
                      {columnas.map((col) => (
                        <th
                          key={col.key}
                          className="whitespace-nowrap p-2 text-left font-semibold"
                        >
                          <button
                            type="button"
                            onClick={() => handleSort(col.key)}
                            className="inline-flex items-center gap-1 hover:text-yellow-600"
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
          </CardContent>
        </Card>
      </main>
    </PlanGate>
  )
}