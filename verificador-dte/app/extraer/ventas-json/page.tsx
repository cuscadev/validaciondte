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
} from 'lucide-react'
import * as XLSX from 'xlsx-js-style'

type VentaResultado = {
  Generacion: string
  NumeroControl: string
  Fecha: string
  FechaISO: string
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

type ColumnKey = keyof VentaResultado

const ROWS_OPTIONS = [10, 20, 50, 100]

export default function VentasJsonPage() {
  const inputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [data, setData] = useState<VentaResultado[]>([])
  const [search, setSearch] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const [filterTipoDte, setFilterTipoDte] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )

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

  const procesarArchivo = async (file: File): Promise<VentaResultado> => {
    try {
      const obj = JSON.parse(await file.text())

      const identificacion = obj?.identificacion || {}
      const receptor = obj?.receptor || {}
      const resumen = obj?.resumen || {}

      const tipoDte = String(identificacion?.tipoDte || '')
      const fechaISO = String(identificacion?.fecEmi || '')

      const exenta = toNumber(resumen?.totalExenta)
      const gravada = toNumber(resumen?.totalGravada)
      const iva = Number((gravada * 0.13).toFixed(2))
      const percepcion = gravada > 100 ? Number((gravada * 0.01).toFixed(2)) : 0

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
        Generacion: String(identificacion?.codigoGeneracion || ''),
        NumeroControl: String(identificacion?.numeroControl || ''),
        Fecha: formatDate(fechaISO),
        FechaISO: fechaISO,
        NIT: String(receptor?.nit || ''),
        NRC: String(receptor?.nrc || ''),
        Contribuyente: String(receptor?.nombre || '').toUpperCase(),
        TipoDte: tipoDte,
        TipoDocumento: tipoDocumento(tipoDte),
        Exenta: exenta,
        MontoGravado: gravada,
        IVA: iva,
        Percepcion: percepcion,
        TotalPagar: toNumber(resumen?.totalPagar),
        SelloRecibido: String(selloRecibido),
        Archivo: file.name,
        Error: '',
      }
    } catch {
      return {
        Generacion: '',
        NumeroControl: '',
        Fecha: '',
        FechaISO: '',
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

  const columnas = useMemo(
    () =>
      [
        { key: 'Generacion', label: 'Código Generación' },
        { key: 'NumeroControl', label: 'N° Control' },
        { key: 'Fecha', label: 'Fecha' },
        { key: 'NIT', label: 'NIT' },
        { key: 'NRC', label: 'NRC' },
        { key: 'Contribuyente', label: 'Cliente' },
        { key: 'TipoDte', label: 'Tipo DTE' },
        { key: 'TipoDocumento', label: 'Documento' },
        { key: 'Exenta', label: 'Exenta' },
        { key: 'MontoGravado', label: 'Gravado' },
        { key: 'IVA', label: 'IVA' },
        { key: 'TotalPagar', label: 'Total Pagar' },
        { key: 'Percepcion', label: 'Percepción' },
        { key: 'SelloRecibido', label: 'Sello Recibido' },
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

      resultados.sort((a, b) => {
        const da = a.FechaISO ? new Date(a.FechaISO).getTime() : 0
        const db = b.FechaISO ? new Date(b.FechaISO).getTime() : 0
        return da - db
      })

      setData(resultados)

      const successCount = resultados.filter((r) => !r.Error).length
      const errorCount = resultados.filter((r) => r.Error).length

      setMsg(
        errorCount > 0
          ? `✅ Procesamiento finalizado con ${errorCount} error(es).`
          : '✅ Procesamiento finalizado.'
      )

      await recordProcessingLog({
        routeKey: 'ventas-json',
        moduleName: 'Procesador Ventas JSON',
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
      const message = error instanceof Error ? error.message : 'Error inesperado'

      setMsg(`❌ ${message}`)

      await recordProcessingLog({
        routeKey: 'ventas-json',
        moduleName: 'Procesador Ventas JSON',
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
          r.Generacion,
          r.NumeroControl,
          r.Fecha,
          r.NIT,
          r.NRC,
          r.Contribuyente,
          r.TipoDte,
          r.TipoDocumento,
          r.SelloRecibido,
          r.Archivo,
          r.Error,
        ].some((v) => String(v || '').toLowerCase().includes(q))

      const matchTipoDte = !filterTipoDte || r.TipoDte === filterTipoDte

      const matchFrom = !filterFrom || r.FechaISO >= filterFrom
      const matchTo = !filterTo || r.FechaISO <= filterTo

      return matchSearch && matchTipoDte && matchFrom && matchTo
    })
  }, [data, search, filterTipoDte, filterFrom, filterTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [filtered.length, rowsPerPage, totalPages, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterTipoDte, filterFrom, filterTo])

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

  const renderValue = (row: VentaResultado, key: ColumnKey) => {
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
          className={`rounded-full px-2 py-0.5 text-xs ${tipoDtePill(
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

  const exportExcel = (rows: VentaResultado[]) => {
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

    const ventas = validRows.map((r) => ({
      Generacion: r.Generacion,
      NumeroControl: r.NumeroControl,
      Fecha: r.Fecha,
      NIT: r.NIT,
      NRC: r.NRC,
      Contribuyente: r.Contribuyente,
      TipoDte: r.TipoDte,
      TipoDocumento: r.TipoDocumento,
      Exenta: r.Exenta,
      MontoGravado: r.MontoGravado,
      IVA: r.IVA,
      TotalPagar: r.TotalPagar,
      Percepcion: r.Percepcion,
      SelloRecibido: r.SelloRecibido,
      Archivo: r.Archivo,
    }))

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(ventas),
      'Resumen de Ventas'
    )

    const resumenDiario = Object.values(
      validRows.reduce<
        Record<
          string,
          {
            Fecha: string
            Exenta: number
            MontoGravado: number
            IVA: number
            TotalPagar: number
            Percepcion: number
            Registros: number
          }
        >
      >((acc, row) => {
        const key = row.Fecha || 'SIN FECHA'

        if (!acc[key]) {
          acc[key] = {
            Fecha: row.Fecha,
            Exenta: 0,
            MontoGravado: 0,
            IVA: 0,
            TotalPagar: 0,
            Percepcion: 0,
            Registros: 0,
          }
        }

        acc[key].Exenta += row.Exenta
        acc[key].MontoGravado += row.MontoGravado
        acc[key].IVA += row.IVA
        acc[key].TotalPagar += row.TotalPagar
        acc[key].Percepcion += row.Percepcion
        acc[key].Registros += 1

        return acc
      }, {})
    )

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(resumenDiario),
      'Resumen Diario'
    )

    const resumenCliente = Object.values(
      validRows.reduce<
        Record<
          string,
          {
            NIT: string
            NRC: string
            Contribuyente: string
            MontoGravado: number
            IVA: number
            TotalPagar: number
            Percepcion: number
            Registros: number
          }
        >
      >((acc, row) => {
        const key = row.NRC || row.NIT || row.Contribuyente || 'SIN CLIENTE'

        if (!acc[key]) {
          acc[key] = {
            NIT: row.NIT,
            NRC: row.NRC,
            Contribuyente: row.Contribuyente,
            MontoGravado: 0,
            IVA: 0,
            TotalPagar: 0,
            Percepcion: 0,
            Registros: 0,
          }
        }

        acc[key].MontoGravado += row.MontoGravado
        acc[key].IVA += row.IVA
        acc[key].TotalPagar += row.TotalPagar
        acc[key].Percepcion += row.Percepcion
        acc[key].Registros += 1

        return acc
      }, {})
    )

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(resumenCliente),
      'Resumen por Cliente'
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
      `ventas_json_${new Date().toISOString().slice(0, 10)}.xlsx`
    )
  }

  const clearAll = () => {
    setData([])
    setSearch('')
    setMsg('')
    setCurrentPage(1)
    setFilterTipoDte('')
    setFilterFrom('')
    setFilterTo(new Date().toISOString().slice(0, 10))

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <PlanGate routeKey="ventas-json">
      <main className="w-full max-w-full dark:bg-background">
        <Card className="w-full max-w-full overflow-hidden border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <CardHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-white/10 dark:bg-zinc-950/90 dark:supports-[backdrop-filter]:bg-zinc-950/80">
            <CardTitle className="text-2xl text-slate-950 dark:text-white">
              Procesador de Ventas JSON
            </CardTitle>

            <CardDescription className="text-slate-600 dark:text-zinc-300">
              Sube documentos DTE en formato JSON para generar resumen de ventas,
              resumen diario y resumen por cliente.
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
                        onClick={() => exportExcel(filtered)}
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
                  Exenta
                </p>
                <p className="font-bold text-slate-950 dark:text-white">
                  {fmt(resumen.exenta)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Gravado
                </p>
                <p className="font-bold text-slate-950 dark:text-white">
                  {fmt(resumen.gravado)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">IVA</p>
                <p className="font-bold text-slate-950 dark:text-white">
                  {fmt(resumen.iva)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Percepción
                </p>
                <p className="font-bold text-slate-950 dark:text-white">
                  {fmt(resumen.percepcion)}
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
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="tipoDte">Tipo DTE</Label>
                  <select
                    id="tipoDte"
                    value={filterTipoDte}
                    onChange={(e) => setFilterTipoDte(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="01">Factura</option>
                    <option value="03">Crédito Fiscal</option>
                    <option value="05">Nota de Crédito</option>
                  </select>
                </div>

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
                      setFilterTipoDte('')
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
                  {filtered.length}
                </span>
                {filtered.length !== data.length && (
                  <span className="text-xs">(de {data.length} totales)</span>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por código, NRC, cliente…"
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
                          {loading ? 'Cargando…' : 'Sin resultados para mostrar.'}
                        </td>
                      </tr>
                    )}

                    {paginatedData.map((r, i) => (
                      <tr
                        key={r.Generacion || r.NumeroControl || r.Archivo || i}
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