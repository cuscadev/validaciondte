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

type LiquidacionResultado = {
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
  TotalPagar: number
  Percepcion: number
  SelloRecibido: string
  Archivo: string
  Error?: string
}

type ColumnKey = keyof LiquidacionResultado
type AnyRow = Record<string, string | number | Date | null | undefined>

const ROWS_OPTIONS = [10, 20, 50, 100]

export default function LiquidacionJsonPage() {
  const inputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [data, setData] = useState<LiquidacionResultado[]>([])
  const [emitters, setEmitters] = useState<AnyRow[]>([])
  const [receivers, setReceivers] = useState<AnyRow[]>([])
  const [liquidaciones, setLiquidaciones] = useState<AnyRow[]>([])
  const [resumenRows, setResumenRows] = useState<AnyRow[]>([])

  const [search, setSearch] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
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

  const safe = (value: unknown) =>
    value === null || value === undefined ? '' : String(value)

  const toNumber = (value: unknown) => {
    const n = Number(value ?? 0)
    return Number.isFinite(n) ? n : 0
  }

  const formatDate = (date?: string) => {
    if (!date || !date.includes('-')) return ''
    const [y, m, d] = date.split('-')
    return `${d}/${m}/${y}`
  }

  const parseDateISO = (value: unknown) => {
    if (!value) return new Date(NaN)

    const str = String(value)
    const date = new Date(str)

    if (Number.isFinite(date.getTime())) return date

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str)

    if (match) {
      const [, y, m, d] = match
      return new Date(Number(y), Number(m) - 1, Number(d))
    }

    return new Date(NaN)
  }

  const procesarArchivo = async (file: File) => {
    try {
      const obj = JSON.parse(await file.text())

      const id = obj?.identificacion || {}
      const tipoDte = String(id?.tipoDte || '')

      if (tipoDte !== '09') {
        return null
      }

      const em = obj?.emisor || {}
      const rc = obj?.receptor || {}
      const c = obj?.cuerpoDocumento || {}

      const sello =
        safe(obj?.selloRecibido) ||
        safe(obj?.responseMH?.selloRecibido) ||
        safe(obj?.respuestaHacienda?.selloRecibido)

      const fechaISO = safe(id?.fecEmi)

      const mg = toNumber(c?.valorOperaciones)
      const iva = toNumber(c?.iva)
      const perc = toNumber(c?.ivaPercibido)
      const total = toNumber(c?.liquidoApagar)

      const visible: LiquidacionResultado = {
        Generacion: safe(id?.codigoGeneracion),
        NumeroControl: safe(id?.numeroControl),
        Fecha: formatDate(fechaISO),
        FechaISO: fechaISO,
        NIT: safe(rc?.nit),
        NRC: safe(rc?.nrc),
        Contribuyente: safe(rc?.nombre).toUpperCase(),
        TipoDte: tipoDte,
        TipoDocumento: 'Doc. Liquidación',
        Exenta: 0,
        MontoGravado: mg,
        IVA: iva,
        TotalPagar: total,
        Percepcion: perc,
        SelloRecibido: sello,
        Archivo: file.name,
        Error: '',
      }

      const emisorRow: AnyRow = {
        NumeroControl: safe(id?.numeroControl),
        CodigoGeneracion: safe(id?.codigoGeneracion),
        FechaEmision: safe(id?.fecEmi),
        Emisor_NIT: safe(em?.nit),
        Emisor_NRC: safe(em?.nrc),
        Emisor_Nombre: safe(em?.nombre),
        Emisor_NombreComercial: safe(em?.nombreComercial),
        Emisor_Actividad: `${safe(em?.codActividad)} - ${safe(
          em?.descActividad
        )}`.trim(),
        Emisor_Telefono: safe(em?.telefono),
        Emisor_Correo: safe(em?.correo),
        Emisor_Departamento: safe(em?.direccion?.departamento),
        Emisor_Municipio: safe(em?.direccion?.municipio),
        Emisor_Direccion: safe(em?.direccion?.complemento),
      }

      const receptorRow: AnyRow = {
        NumeroControl: safe(id?.numeroControl),
        CodigoGeneracion: safe(id?.codigoGeneracion),
        FechaEmision: safe(id?.fecEmi),
        Receptor_NIT: safe(rc?.nit),
        Receptor_NRC: safe(rc?.nrc),
        Receptor_Nombre: safe(rc?.nombre),
        Receptor_NombreComercial: safe(rc?.nombreComercial),
        Receptor_Actividad: `${safe(rc?.codActividad)} - ${safe(
          rc?.descActividad
        )}`.trim(),
        Receptor_Telefono: safe(rc?.telefono),
        Receptor_Correo: safe(rc?.correo),
        Receptor_Departamento: safe(rc?.direccion?.departamento),
        Receptor_Municipio: safe(rc?.direccion?.municipio),
        Receptor_Direccion: safe(rc?.direccion?.complemento),
      }

      const liquidacionRow: AnyRow = {
        NumeroControl: safe(id?.numeroControl),
        CodigoGeneracion: safe(id?.codigoGeneracion),
        Periodo_Inicio: safe(c?.periodoLiquidacionFechaInicio),
        Periodo_Fin: safe(c?.periodoLiquidacionFechaFin),
        ValorOperaciones: toNumber(c?.valorOperaciones),
        SubTotal: toNumber(c?.subTotal),
        IVA: toNumber(c?.iva),
        MontoSujetoPercepcion: toNumber(c?.montoSujetoPercepcion),
        IVAPercibido: toNumber(c?.ivaPercibido),
        Comision: toNumber(c?.comision),
        IVAComision: toNumber(c?.ivaComision),
        PorcentajeComision: toNumber(c?.porcentComision),
        LiquidoAPagar: toNumber(c?.liquidoApagar),
        CodLiquidacion: safe(c?.codLiquidacion),
        CantidadDoc: toNumber(c?.cantidadDoc),
        MontoSinPercepcion: toNumber(c?.montoSinPercepcion),
        DescripSinPercepcion: safe(c?.descripSinPercepcion),
        Observaciones: safe(c?.observaciones),
        TotalLetras: safe(c?.totalLetras),
      }

      const resumenRow: AnyRow = {
        tipoDte: safe(id?.tipoDte),
        numeroControl: safe(id?.numeroControl),
        codigoGeneracion: safe(id?.codigoGeneracion),
        fecEmi: safe(id?.fecEmi),
        horEmi: safe(id?.horEmi),
        Emisor_nit: safe(em?.nit),
        Emisor_nrc: safe(em?.nrc),
        Emisor_nombre: safe(em?.nombre),
        Emisor_nombreComercial: safe(em?.nombreComercial),
        Emisor_telefono: safe(em?.telefono),
        Emisor_correo: safe(em?.correo),
        Receptor_nit: safe(rc?.nit),
        Receptor_nrc: safe(rc?.nrc),
        Receptor_nombre: safe(rc?.nombre),
      }

      Object.keys(c || {}).forEach((key) => {
        resumenRow[key] =
          c[key] === null || c[key] === undefined ? '' : c[key]
      })

      resumenRow.selloRecibido = sello

      return {
        visible,
        emisorRow,
        receptorRow,
        liquidacionRow,
        resumenRow,
      }
    } catch {
      return {
        visible: {
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
          TotalPagar: 0,
          Percepcion: 0,
          SelloRecibido: '',
          Archivo: file.name,
          Error: 'JSON inválido',
        } satisfies LiquidacionResultado,
        emisorRow: null,
        receptorRow: null,
        liquidacionRow: null,
        resumenRow: null,
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
        { key: 'Contribuyente', label: 'Contribuyente' },
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
    setEmitters([])
    setReceivers([])
    setLiquidaciones([])
    setResumenRows([])
    setCurrentPage(1)

    const selectedFiles = Array.from(files)
    const startedAt = new Date()
    const started = performance.now()

    try {
      const resultados = await Promise.all(
        selectedFiles.map((file) => procesarArchivo(file))
      )

      const validResults = resultados.filter(Boolean)
      const ignoredCount = resultados.filter((r) => r === null).length

      const visibleRows = validResults.map((r) => r!.visible)
      const emisorRows = validResults
        .map((r) => r!.emisorRow)
        .filter(Boolean) as AnyRow[]
      const receptorRows = validResults
        .map((r) => r!.receptorRow)
        .filter(Boolean) as AnyRow[]
      const liquidacionRows = validResults
        .map((r) => r!.liquidacionRow)
        .filter(Boolean) as AnyRow[]
      const resumen = validResults
        .map((r) => r!.resumenRow)
        .filter(Boolean) as AnyRow[]

      visibleRows.sort((a, b) => {
        const da = a.FechaISO ? new Date(a.FechaISO).getTime() : 0
        const db = b.FechaISO ? new Date(b.FechaISO).getTime() : 0
        return da - db
      })

      setData(visibleRows)
      setEmitters(emisorRows)
      setReceivers(receptorRows)
      setLiquidaciones(liquidacionRows)
      setResumenRows(resumen)

      const successCount = visibleRows.filter((r) => !r.Error).length
      const errorCount = visibleRows.filter((r) => r.Error).length

      setMsg(
        ignoredCount > 0
          ? `✅ Procesamiento finalizado. ${ignoredCount} archivo(s) ignorado(s) porque no eran DTE tipo 09.`
          : errorCount > 0
            ? `✅ Procesamiento finalizado con ${errorCount} error(es).`
            : '✅ Procesamiento finalizado.'
      )

      await recordProcessingLog({
        routeKey: 'liquidacion-json',
        moduleName: 'Procesador Liquidación JSON',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: summarizeFiles(selectedFiles),
        totalRecords: visibleRows.length,
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
        routeKey: 'liquidacion-json',
        moduleName: 'Procesador Liquidación JSON',
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

      const matchFrom = !filterFrom || r.FechaISO >= filterFrom
      const matchTo = !filterTo || r.FechaISO <= filterTo

      return matchSearch && matchFrom && matchTo
    })
  }, [data, search, filterFrom, filterTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [filtered.length, rowsPerPage, totalPages, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterFrom, filterTo])

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

  const renderValue = (row: LiquidacionResultado, key: ColumnKey) => {
    const value = row[key]

    const isMoney =
      key === 'Exenta' ||
      key === 'MontoGravado' ||
      key === 'IVA' ||
      key === 'Percepcion' ||
      key === 'TotalPagar'

    if (key === 'TipoDte') {
      return (
        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
          {String(value || '')}
        </span>
      )
    }

    if (isMoney) return fmt(Number(value || 0))

    return String(value || '')
  }

  const buildHeaderIndexMap = (ws: XLSX.WorkSheet) => {
    const ref = ws['!ref']
    if (!ref) return {}

    const range = XLSX.utils.decode_range(ref)
    const map: Record<string, number> = {}

    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: range.s.r, c })
      const cell = ws[addr]

      if (cell && cell.v !== null && cell.v !== undefined) {
        map[String(cell.v)] = c
      }
    }

    return map
  }

  const formatDateColumns = (ws: XLSX.WorkSheet, rows: AnyRow[]) => {
    const fechaCampos = [
      'fecEmi',
      'periodoLiquidacionFechaInicio',
      'periodoLiquidacionFechaFin',
    ]

    const headerMap = buildHeaderIndexMap(ws)

    fechaCampos.forEach((colName) => {
      const colIdx = headerMap[colName]

      if (colIdx === undefined) return

      for (let r = 0; r < rows.length; r++) {
        const addr = XLSX.utils.encode_cell({ r: r + 1, c: colIdx })
        const cell = ws[addr]
        const raw = rows[r][colName]

        if (!cell || !raw) continue

        const date = parseDateISO(raw)

        if (Number.isFinite(date.getTime())) {
          cell.t = 'd'
          cell.v = date
          cell.z = 'dd/mm/yyyy'
        }
      }
    })
  }

  const exportExcel = () => {
    if (!data.length) {
      setMsg('❌ No hay datos para exportar.')
      return
    }

    const wb = XLSX.utils.book_new()

    const filteredControls = new Set(filtered.map((r) => r.NumeroControl))

    const resumenExport = resumenRows.filter((r) =>
      filteredControls.has(String(r.numeroControl || ''))
    )

    const wsResumen = XLSX.utils.json_to_sheet(resumenExport)
    formatDateColumns(wsResumen, resumenExport)
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Liquidación (Resumen)')

    if (emitters.length) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(emitters),
        'Emisor'
      )
    }

    if (receivers.length) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(receivers),
        'Receptor'
      )
    }

    if (liquidaciones.length) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(liquidaciones),
        'Detalle Liquidación'
      )
    }

    XLSX.writeFile(
      wb,
      `liquidacion_json_${new Date().toISOString().slice(0, 10)}.xlsx`
    )
  }

  const clearAll = () => {
    setData([])
    setEmitters([])
    setReceivers([])
    setLiquidaciones([])
    setResumenRows([])
    setSearch('')
    setMsg('')
    setCurrentPage(1)
    setFilterFrom('')
    setFilterTo(new Date().toISOString().slice(0, 10))

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <PlanGate routeKey="liquidacion-json">
      <main className="w-full max-w-full dark:bg-background">
        <Card className="w-full max-w-full overflow-hidden border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <CardHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-white/10 dark:bg-zinc-950/90 dark:supports-[backdrop-filter]:bg-zinc-950/80">
            <CardTitle className="text-2xl text-slate-950 dark:text-white">
              Procesador de Liquidación JSON
            </CardTitle>

            <CardDescription className="text-slate-600 dark:text-zinc-300">
              Sube documentos DTE tipo 09 para generar liquidación, emisor,
              receptor y detalle en Excel.
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
                    Solo se procesarán documentos con tipoDte 09.
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
                        onClick={exportExcel}
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
                    placeholder="Buscar por código, NRC, receptor…"
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