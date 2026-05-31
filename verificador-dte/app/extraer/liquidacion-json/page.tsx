'use client'

import PlanGate from '@/components/PlanGate'
import UploadFormSection from '@/components/upload/UploadFormSection'
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
  extractReceptor,
  extractSelloFromJson,
} from '@/lib/dte-json-fields'
import { summarizeDteUploadResults } from '@/lib/upload-dte-stats'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
} from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { toast } from 'sonner'

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<LiquidacionResultado[]>([])
  const [emitters, setEmitters] = useState<AnyRow[]>([])
  const [receivers, setReceivers] = useState<AnyRow[]>([])
  const [liquidaciones, setLiquidaciones] = useState<AnyRow[]>([])
  const [resumenRows, setResumenRows] = useState<AnyRow[]>([])

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
      const obj = JSON.parse(await file.text()) as Record<string, unknown>

      const identificacion = extractIdentificacion(obj)
      const tipoDte = identificacion.tipoDte

      if (tipoDte !== '09') {
        return null
      }

      const em = (obj?.emisor || {}) as Record<string, unknown>
      const rc = extractReceptor(obj)
      const c = (obj?.cuerpoDocumento || {}) as Record<string, unknown>

      const sello = extractSelloFromJson(obj)
      const fechaISO = identificacion.fechaISO

      const mg = toNumber(c?.valorOperaciones)
      const iva = toNumber(c?.iva)
      const perc = toNumber(c?.ivaPercibido)
      const total = toNumber(c?.liquidoApagar)

      const visible: LiquidacionResultado = {
        Generacion: identificacion.generacion,
        NumeroControl: identificacion.numeroControl,
        Fecha: formatDate(fechaISO),
        FechaISO: fechaISO,
        NIT: rc.nit,
        NRC: rc.nrc,
        Contribuyente: rc.nombre,
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
        NumeroControl: identificacion.numeroControl,
        CodigoGeneracion: identificacion.generacion,
        FechaEmision: identificacion.fechaISO,
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

      const receptorObj = (obj?.receptor || {}) as Record<string, unknown>
      const receptorDireccion = (receptorObj?.direccion || {}) as Record<string, unknown>

      const receptorRow: AnyRow = {
        NumeroControl: identificacion.numeroControl,
        CodigoGeneracion: identificacion.generacion,
        FechaEmision: identificacion.fechaISO,
        Receptor_NIT: safe(receptorObj?.nit),
        Receptor_NRC: safe(receptorObj?.nrc),
        Receptor_Nombre: safe(receptorObj?.nombre),
        Receptor_NombreComercial: safe(receptorObj?.nombreComercial),
        Receptor_Actividad: `${safe(receptorObj?.codActividad)} - ${safe(
          receptorObj?.descActividad
        )}`.trim(),
        Receptor_Telefono: safe(receptorObj?.telefono),
        Receptor_Correo: safe(receptorObj?.correo),
        Receptor_Departamento: safe(receptorDireccion?.departamento),
        Receptor_Municipio: safe(receptorDireccion?.municipio),
        Receptor_Direccion: safe(receptorDireccion?.complemento),
      }

      const liquidacionRow: AnyRow = {
        NumeroControl: identificacion.numeroControl,
        CodigoGeneracion: identificacion.generacion,
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
        tipoDte: identificacion.tipoDte,
        numeroControl: identificacion.numeroControl,
        codigoGeneracion: identificacion.generacion,
        fecEmi: identificacion.fechaISO,
        horEmi: safe((obj?.identificacion as Record<string, unknown>)?.horEmi),
        Emisor_nit: safe(em?.nit),
        Emisor_nrc: safe(em?.nrc),
        Emisor_nombre: safe(em?.nombre),
        Emisor_nombreComercial: safe(em?.nombreComercial),
        Emisor_telefono: safe(em?.telefono),
        Emisor_correo: safe(em?.correo),
        Receptor_nit: safe(receptorObj?.nit),
        Receptor_nrc: safe(receptorObj?.nrc),
        Receptor_nombre: safe(receptorObj?.nombre),
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

    if (selectedFiles.length === 0) {
      toast.warning('Selecciona uno o más archivos .json')
      return
    }

    setLoading(true)
    resetResultsVisibility()
    setData([])
    setEmitters([])
    setReceivers([])
    setLiquidaciones([])
    setResumenRows([])
    setCurrentPage(1)
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
      accordionApiRef.current?.setProcessingSummary(
        summarizeDteUploadResults(visibleRows)
      )
      setEmitters(emisorRows)
      setReceivers(receptorRows)
      setLiquidaciones(liquidacionRows)
      setResumenRows(resumen)

      const successCount = visibleRows.filter((r) => !r.Error).length
      const errorCount = visibleRows.filter((r) => r.Error).length

      toast.success(
        ignoredCount > 0
          ? `Procesamiento finalizado. ${ignoredCount} archivo(s) ignorado(s) porque no eran DTE tipo 09.`
          : errorCount > 0
            ? `Procesamiento finalizado con ${errorCount} error(es).`
            : 'Procesamiento finalizado.'
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

      toast.error(message)

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
      toast.error('No hay datos para exportar.')
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
    resetResultsVisibility()
    setData([])
    setEmitters([])
    setReceivers([])
    setLiquidaciones([])
    setResumenRows([])
    setSearch('')
    setCurrentPage(1)
    setFilterFrom('')
    setFilterTo(new Date().toISOString().slice(0, 10))

    setSelectedFiles([])
  }

  return (
    <PlanGate routeKey="liquidacion-json">
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
                label="Archivos JSON"
                briefHint="Solo tipo DTE 09"
                helpContent={
                  <>
                    <p>
                      Sube documentos DTE tipo 09 para generar liquidacion, emisor, receptor y detalle en Excel.
                    </p>
                    <p className="mt-2 text-xs opacity-90">Solo se procesaran documentos con tipoDte 09.</p>
                  </>
                }
                files={selectedFiles}
                onFilesChange={setSelectedFiles}
                loading={loading}
                accept={{ 'application/json': ['.json'] }}
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

            <UploadTableToolbar
              resultCount={{ filtered: filtered.length, total: data.length }}
              export={{
                excel: {
                  onClick: exportExcel,
                  label: 'Descargar Excel completo',
                },
                csv: {
                  onClick: () =>
                    exportRowsToCsv(
                      data as Record<string, unknown>[],
                      buildExportFilename('liquidacion_json', 'csv')
                    ),
                },
                pdf: {
                  onClick: () =>
                    exportPdfByProfile(
                      data as Record<string, unknown>[],
                      'liquidacion',
                      buildExportFilename('liquidacion_json', 'pdf')
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
                      searchPlaceholder="Buscar por código, NRC, receptor…"
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
            </UploadResultsReveal>
      </main>
    </PlanGate>
  )
}