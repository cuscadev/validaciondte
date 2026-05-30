'use client'

import PlanGate from '@/components/PlanGate'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { recordProcessingLog } from '@/lib/client-processing-log'
import { summarizeFiles, summarizeResults } from '@/lib/processing-log'
import { Moon, Sun, FileUp, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react'

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
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [dark, setDark] = useState(false)
  const [data, setData] = useState<Resultado[]>([])
  const [downloadHref, setDownloadHref] = useState<string | null>(null)
  const [filename, setFilename] = useState('resultados_dtes.xlsx')

  // 🔎 UIX: búsqueda & paginación
  const [search, setSearch] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const toggleTheme = () => {
    setDark((d) => !d)
    document.documentElement.classList.toggle('dark')
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const files = inputRef.current?.files
    if (!files || files.length === 0) {
      setMsg('Selecciona uno o más archivos CSV o Excel')
      return
    }

    setLoading(true)
    setMsg('Procesando…')
    setData([])
    setDownloadHref(null)
    setCurrentPage(1)
    const selectedFiles = Array.from(files)
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
      setFilename(json.filename || 'resultados_dtes.xlsx')

      setDownloadHref(
        json.downloadUrl ||
        (json.excelBase64
          ? `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${json.excelBase64}`
          : null)
      )

      setMsg('✅ Procesamiento finalizado. Revisa la tabla y descarga el Excel.')
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
      setMsg(`❌ ${e?.message || 'Error inesperado'}`)
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
      {/* Toggle theme */}
      <div className="absolute top-4 right-4">
        <Button variant="outline" onClick={toggleTheme}>
          {dark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
          {dark ? 'Claro' : 'Oscuro'}
        </Button>
      </div>

      <Card className="w-full max-w-full overflow-hidden border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <CardHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-white/10 dark:bg-zinc-950/90 dark:supports-[backdrop-filter]:bg-zinc-950/80">
          <CardTitle className="text-2xl text-slate-950 dark:text-white">🧾 Verificador de DTE</CardTitle>
          <CardDescription className="text-slate-600 dark:text-zinc-300">
            Sube uno o varios archivos CSV o Excel con enlaces de Hacienda. Verás una tabla con los resultados y podrás descargar el Excel.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Formulario */}
          <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
              <div className="space-y-2">
                <Label htmlFor="file">Archivos CSV o Excel</Label>
                <Input id="file" ref={inputRef} type="file" accept=".csv,.txt,.xlsx,.xls,.xlsm" multiple />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading} className="w-full bg-yellow-400 font-bold text-black hover:bg-yellow-300 sm:w-auto">
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

                {downloadHref && (
                  <a
                    href={downloadHref}
                    download={filename}
                    className="inline-flex items-center justify-center rounded-md border border-yellow-400 bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300"
                  >
                    Descargar Excel
                  </a>
                )}
              </div>
            </div>

            {msg && (
              <div
                className={`text-sm rounded-md p-3 ${
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

          <section className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 shadow-sm dark:border-white/10 dark:bg-black dark:text-white">
            <h2 className="font-semibold text-amber-600 dark:text-yellow-300">Indicaciones para revisar la tabla</h2>
            <p className="mt-1 text-slate-600 dark:text-zinc-300">
              Revisa el estado de cada DTE, usa el buscador para ubicar códigos o números de control y abre el enlace de la columna Visitar cuando necesites validar el documento en Hacienda.
            </p>
          </section>

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
        </CardContent>
      </Card>
    </main>
    </PlanGate>
  )
}
