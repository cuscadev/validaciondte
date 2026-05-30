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
import {
  Moon, Sun, FileUp, Loader2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search,
  Download, FileSpreadsheet, Info
} from 'lucide-react'

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
  error?: string
  linkVisita?: string
  visitar?: string
}

export default function VerificarPorCodigoYFechaPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [dark, setDark] = useState(false)
  const [data, setData] = useState<Resultado[]>([])
  const [downloadHref, setDownloadHref] = useState<string | null>(null)
  const [filename, setFilename] = useState('resultados_dtes.xlsx')

  // búsqueda & paginación
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
      setMsg('Selecciona uno o más archivos .xlsx / .csv / .txt')
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

      const res = await fetch('/api/verificarcodyfecha', { method: 'POST', body: fd })
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
      setFilename(json.filename || 'resultados_dtes.xlsx')

      if (json.downloadUrl) {
        setDownloadHref(json.downloadUrl)
      } else if (json.excelBase64) {
        const href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${json.excelBase64}`
        setDownloadHref(href)
      }

      setMsg('✅ Procesamiento finalizado. Revisa la tabla y descarga el Excel.')
      await recordProcessingLog({
        routeKey: 'verificarodyfecha',
        moduleName: 'Verificar por Codigo y Fecha',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: summarizeFiles(selectedFiles),
        ...summarizeResults(json.resultados || []),
      })
    } catch (e: any) {
      setMsg(`❌ ${e?.message || 'Error inesperado'}`)
      await recordProcessingLog({
        routeKey: 'verificarodyfecha',
        moduleName: 'Verificar por Codigo y Fecha',
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
    { key: 'fechaEmi', label: 'Fecha Emi.' },
    { key: 'estado', label: 'Estado' },
    { key: 'descripcionEstado', label: 'Descripción Estado' },
    { key: 'tipoDte', label: 'Tipo DTE' },
    { key: 'numeroControl', label: 'N° Control' },
    { key: 'montoTotal', label: 'Monto Total' },
    { key: 'error', label: 'Error' },
    { key: 'visitar', label: 'Visitar' },
  ] as const), [])

  // filtro por búsqueda (incluye linkVisita/url)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(r => {
      const campos = [
        r.codGen, r.fechaEmi, r.estado, r.descripcionEstado, r.tipoDte,
        r.numeroControl, r.montoTotal, r.linkVisita, r.url
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
    <PlanGate routeKey="verificarodyfecha">
    <main className="w-full max-w-full">
      {/* Toggle theme */}
      <div className="absolute top-4 right-4">
        <Button variant="outline" onClick={toggleTheme}>
          {dark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
          {dark ? 'Claro' : 'Oscuro'}
        </Button>
      </div>

      <Card className="w-full max-w-full overflow-hidden border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <CardHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-white/10 dark:bg-zinc-950/90 dark:supports-[backdrop-filter]:bg-zinc-950/80">
          <CardTitle className="text-2xl text-slate-950 dark:text-white">🧾 Verificar por Código y Fecha</CardTitle>
          <CardDescription className="text-slate-600 dark:text-zinc-300">
            Sube uno o varios archivos <b>Excel/CSV/TXT</b> con <b>Columna A = codGen</b> y <b>Columna B = fecha</b>.
            Verás los resultados y podrás descargar el Excel consolidado.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <section className="grid gap-4 rounded-lg border border-yellow-400/30 bg-yellow-50 p-4 text-slate-950 dark:border-yellow-400/25 dark:bg-yellow-400/10 dark:text-white lg:grid-cols-[1fr_auto]">
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-yellow-400 text-black">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">Formato requerido para subir el archivo</h2>
                <p className="mt-1 text-sm text-slate-700 dark:text-zinc-300">
                  Usa la plantilla para evitar errores. La primera hoja debe tener dos columnas:
                  <b> codGen</b> en la columna A y <b> fecha</b> en la columna B.
                </p>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                  <div className="rounded-md border border-yellow-400/30 bg-white/70 p-3 dark:bg-black/30">
                    <div className="font-medium">Columna A</div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-zinc-400">Codigo de generacion UUID.</div>
                  </div>
                  <div className="rounded-md border border-yellow-400/30 bg-white/70 p-3 dark:bg-black/30">
                    <div className="font-medium">Columna B</div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-zinc-400">Fecha en yyyy-MM-dd o dd/MM/yyyy.</div>
                  </div>
                  <div className="rounded-md border border-yellow-400/30 bg-white/70 p-3 dark:bg-black/30">
                    <div className="font-medium">Archivos</div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-zinc-400">Acepta .xlsx, .xls, .csv y .txt.</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start">
              <Button asChild className="bg-yellow-400 font-bold text-black hover:bg-yellow-300">
                <a href="/api/verificarcodyfecha" download>
                  <Download className="mr-2 size-4" />
                  Descargar plantilla
                </a>
              </Button>
            </div>
          </section>

          {/* Formulario */}
          <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
              <div className="space-y-2">
                <Label htmlFor="file">Archivos (.xlsx, .csv, .txt)</Label>
                <Input id="file" ref={inputRef} type="file" accept=".xlsx,.csv,.txt" multiple />
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

            <div className="text-xs text-muted-foreground">
              Ejemplo de filas válidas:
              <div className="mt-1 rounded-md bg-slate-100 px-3 py-1 text-slate-700 dark:bg-zinc-900 dark:text-zinc-200">
                <div><b>A:</b> xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx</div>
                <div><b>B:</b> xxxx-xx-xx</div>
              </div>
            </div>
            <div className="flex gap-2 rounded-md bg-slate-100 p-3 text-xs text-slate-700 dark:bg-zinc-900 dark:text-zinc-200">
              <Info className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-300" />
              <div>
                <div className="font-medium">Ejemplo recomendado</div>
                <div className="mt-1"><b>A:</b> 12345678-1234-1234-1234-123456789ABC</div>
                <div><b>B:</b> 2026-01-15 o 15/01/2026</div>
                <div className="mt-1 text-slate-500 dark:text-zinc-400">
                  Puedes incluir encabezados. Si la primera fila dice codGen y fecha, el sistema la omitira automaticamente.
                </div>
              </div>
            </div>
          </form>

          <section className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 shadow-sm dark:border-white/10 dark:bg-black dark:text-white">
            <h2 className="font-semibold text-amber-600 dark:text-yellow-300">Indicaciones para revisar la tabla</h2>
            <p className="mt-1 text-slate-600 dark:text-zinc-300">
              Confirma que cada fila tenga código y fecha válidos, revisa el estado devuelto por Hacienda y filtra por código, fecha o estado para localizar resultados específicos.
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
                  placeholder="Buscar por código, fecha, estado…"
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
