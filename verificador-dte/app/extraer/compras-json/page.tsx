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
} from 'lucide-react'
import * as XLSX from 'xlsx-js-style'

type CompraResultado = {
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

type ColumnKey = keyof CompraResultado

type TributoDte = {
  codigo?: string
  valor?: number
}

export default function ComprasJsonPage() {
  const inputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [data, setData] = useState<CompraResultado[]>([])
  const [search, setSearch] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

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

  const procesarArchivo = async (file: File): Promise<CompraResultado> => {
    try {
      const obj = JSON.parse(await file.text())

      const identificacion = obj?.identificacion || {}
      const emisor = obj?.emisor || {}
      const resumen = obj?.resumen || {}

      const tipoDte = String(identificacion?.tipoDte || '')
      const fechaISO = String(identificacion?.fecEmi || '')

      const exenta = toNumber(resumen?.totalExenta)
      const gravada = toNumber(resumen?.totalGravada)

      const ivaTributo = Array.isArray(resumen?.tributos)
        ? toNumber(
            resumen.tributos.find(
              (t: TributoDte) => String(t?.codigo) === '20'
            )?.valor
          )
        : 0

      const ivaDesdeResumen =
        toNumber(resumen?.totalIva) ||
        toNumber(resumen?.ivaPerci1) ||
        ivaTributo

      const iva =
        ivaDesdeResumen > 0
          ? ivaDesdeResumen
          : Number((gravada * 0.13).toFixed(2))

      const percepcion =
        gravada > 100 ? Number((gravada * 0.01).toFixed(2)) : 0

      const selloRecibido =
        obj?.selloRecibido ||
        obj?.selloRecepcion ||
        obj?.SelloRecibido ||
        obj?.SelloRecepcion ||
        obj?.respuestaHacienda?.selloRecibido ||
        obj?.respuestaHacienda?.selloRecepcion ||
        obj?.respuestaHacienda?.SelloRecibido ||
        obj?.respuestaHacienda?.SelloRecepcion ||
        obj?.responseHacienda?.selloRecibido ||
        obj?.responseHacienda?.selloRecepcion ||
        ''

      return {
        Generacion: String(identificacion?.codigoGeneracion || ''),
        NumeroControl: String(identificacion?.numeroControl || ''),
        Fecha: formatDate(fechaISO),
        FechaISO: fechaISO,
        NIT: String(emisor?.nit || ''),
        NRC: String(emisor?.nrc || ''),
        Contribuyente: String(emisor?.nombre || '').toUpperCase(),
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

  const exportExcel = (rows: CompraResultado[]) => {
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
        const key = row.NRC || row.NIT || row.Contribuyente || 'SIN PROVEEDOR'

        if (!acc[key]) {
          acc[key] = {
            NIT: row.NIT,
            NRC: row.NRC,
            Contribuyente: row.Contribuyente,
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

      setMsg(`❌ ${message}`)

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
        { key: 'NIT', label: 'NIT' },
        { key: 'NRC', label: 'NRC' },
        { key: 'Contribuyente', label: 'Contribuyente' },
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
        r.NIT,
        r.NRC,
        r.Contribuyente,
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
      <main className="w-full max-w-full dark:bg-background">
        <Card className="w-full max-w-full overflow-hidden border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <CardHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-white/10 dark:bg-zinc-950/90 dark:supports-[backdrop-filter]:bg-zinc-950/80">
            <CardTitle className="text-2xl text-slate-950 dark:text-white">
               Procesador de Compras JSON
            </CardTitle>

            <CardDescription className="text-slate-600 dark:text-zinc-300">
              Sube documentos DTE en formato JSON para generar el libro de
              compras, resumen diario y resumen por proveedor.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <form
              onSubmit={onSubmit}
              className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black"
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
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

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-yellow-400 font-bold text-black hover:bg-yellow-300 sm:w-auto"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                        Procesando…
                      </>
                    ) : (
                      <>
                        <FileUp className="w-4 h-4 mr-2" />
                        Procesar
                      </>
                    )}
                  </Button>

                  {data.length > 0 && (
                    <Button
                      type="button"
                      onClick={() => exportExcel(filtered)}
                      className="w-full bg-yellow-400 font-bold text-black hover:bg-yellow-300 sm:w-auto"
                    >
                      Descargar Excel
                    </Button>
                  )}
                </div>
              </div>

              {msg && (
                <div
                  className={`text-sm rounded-md p-3 ${
                    msg.startsWith('')
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

            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="hidden sm:inline">Resultados:</span>
                <span className="font-medium text-foreground">
                  {filtered.length}
                </span>
                {filtered.length !== data.length && (
                  <span className="text-xs">(de {data.length} totales)</span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por código, NRC, proveedor…"
                    className="pl-9 w-[280px]"
                  />
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
                    {[10, 20, 50, 100].map((n) => (
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
          </CardContent>
        </Card>
      </main>
    </PlanGate>
  )
}