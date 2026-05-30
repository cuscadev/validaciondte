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
import jsQR from 'jsqr'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

type QrPdfResultado = {
  Archivo: string
  Ambiente: string
  CodigoGeneracion: string
  FechaEmision: string
  HostOriginal: string
  UrlOriginal: string
  UrlNormalizada: string
  Estado: string
  Error?: string
}

type ColumnKey = keyof QrPdfResultado

const MAX_FILES = 100

export default function QrPdfPage() {
  const inputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [progress, setProgress] = useState('')
  const [data, setData] = useState<QrPdfResultado[]>([])
  const [search, setSearch] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const normalizarUrl = (raw: string) => {
    const match = raw.match(/https?:\/\/[^\s"'<>]+/i)

    const urlText = match
      ? match[0].replace(/[,\.;]+$/g, '')
      : raw.trim()

    const url = new URL(urlText)

    const ambiente = url.searchParams.get('ambiente') || '01'
    const codGen = url.searchParams.get('codGen') || ''
    const fechaEmi = url.searchParams.get('fechaEmi') || ''

    if (!codGen || !fechaEmi) {
      throw new Error('El QR no contiene codGen o fechaEmi.')
    }

    const params = new URLSearchParams()

    params.set('ambiente', ambiente)
    params.set('codGen', codGen)
    params.set('fechaEmi', fechaEmi)

    return {
      ambiente,
      codGen,
      fechaEmi,
      hostOriginal: url.host,
      urlOriginal: urlText,
      urlNormalizada: `https://admin.factura.gob.sv/consultaPublica?${params.toString()}`,
    }
  }

  const leerQrDesdePdf = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer()

    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
    }).promise

    const page = await pdf.getPage(1)

    const viewport = page.getViewport({
      scale: 2.5,
    })

    const canvas = document.createElement('canvas')

    const context = canvas.getContext('2d', {
      willReadFrequently: true,
    })

    if (!context) {
      throw new Error('No se pudo preparar el lector.')
    }

    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise

    const imageData = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    )

    const qr = jsQR(
      imageData.data,
      imageData.width,
      imageData.height
    )

    if (!qr?.data) {
      throw new Error(
        'No se encontró código QR en la primera página.'
      )
    }

    return qr.data
  }

  const procesarArchivo = async (
    file: File
  ): Promise<QrPdfResultado> => {
    try {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('El archivo no es PDF.')
      }

      const qrText = await leerQrDesdePdf(file)

      const normalizado = normalizarUrl(qrText)

      return {
        Archivo: file.name,
        Ambiente: normalizado.ambiente,
        CodigoGeneracion: normalizado.codGen,
        FechaEmision: normalizado.fechaEmi,
        HostOriginal: normalizado.hostOriginal,
        UrlOriginal: normalizado.urlOriginal,
        UrlNormalizada: normalizado.urlNormalizada,
        Estado: 'PROCESADO',
        Error: '',
      }
    } catch (error) {
      return {
        Archivo: file.name,
        Ambiente: '',
        CodigoGeneracion: '',
        FechaEmision: '',
        HostOriginal: '',
        UrlOriginal: '',
        UrlNormalizada: '',
        Estado: 'ERROR',
        Error:
          error instanceof Error
            ? error.message
            : 'Error inesperado',
      }
    }
  }

  const csvValue = (value: unknown) => {
    const text = String(value ?? '')
    return `"${text.replace(/"/g, '""')}"`
  }

  const descargarCsv = (rows: QrPdfResultado[]) => {
    if (!rows.length) {
      setMsg('No hay datos para descargar.')
      return
    }

    const headers: ColumnKey[] = [
      'Archivo',
      'Ambiente',
      'CodigoGeneracion',
      'FechaEmision',
      'HostOriginal',
      'UrlOriginal',
      'UrlNormalizada',
      'Estado',
      'Error',
    ]

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => csvValue(row[header]))
          .join(',')
      ),
    ].join('\n')

    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')

    a.href = url

    a.download = `qr_pdf_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`

    document.body.appendChild(a)

    a.click()

    document.body.removeChild(a)

    URL.revokeObjectURL(url)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const files = inputRef.current?.files

    if (!files || files.length === 0) {
      setMsg('Selecciona uno o más archivos PDF.')
      return
    }

    const selectedFiles = Array.from(files)

    if (selectedFiles.length > MAX_FILES) {
      setMsg(
        `Solo puedes procesar máximo ${MAX_FILES} archivos PDF por lote.`
      )
      return
    }

    setLoading(true)
    setMsg('Procesando…')
    setProgress('')
    setData([])
    setCurrentPage(1)

    const resultados: QrPdfResultado[] = []

    const startedAt = new Date()

    const started = performance.now()

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        setProgress(
          `Procesando ${i + 1} de ${selectedFiles.length}`
        )

        const resultado = await procesarArchivo(
          selectedFiles[i]
        )

        resultados.push(resultado)
      }

      setData(resultados)

      const successCount = resultados.filter(
        (r) => r.Estado === 'PROCESADO'
      ).length

      const errorCount = resultados.filter(
        (r) => r.Estado === 'ERROR'
      ).length

      setMsg(
        errorCount > 0
          ? `Procesamiento finalizado con ${errorCount} error(es).`
          : 'Procesamiento finalizado.'
      )

      await recordProcessingLog({
        routeKey: 'qr-pdf',
        moduleName: 'Extractor QR desde PDF',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(
          performance.now() - started
        ),
        files: summarizeFiles(selectedFiles),
        totalRecords: resultados.length,
        successCount,
        errorCount,
        statusBreakdown: {
          PROCESADO: successCount,
          ERROR: errorCount,
        },
        outcome:
          errorCount > 0 ? 'error' : 'success',
      })
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error inesperado'

      setMsg(message)

      await recordProcessingLog({
        routeKey: 'qr-pdf',
        moduleName: 'Extractor QR desde PDF',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(
          performance.now() - started
        ),
        files: summarizeFiles(selectedFiles),
        totalRecords: 0,
        successCount: 0,
        errorCount: selectedFiles.length,
        statusBreakdown: {
          ERROR: selectedFiles.length,
        },
        outcome: 'error',
        errorMessage: message,
      })
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const columnas = useMemo(
    () =>
      [
        {
          key: 'Archivo',
          label: 'Archivo',
        },
        {
          key: 'CodigoGeneracion',
          label: 'Código Generación',
        },
        {
          key: 'FechaEmision',
          label: 'Fecha Emisión',
        },
        {
          key: 'Ambiente',
          label: 'Ambiente',
        },
        {
          key: 'HostOriginal',
          label: 'Host Original',
        },
        {
          key: 'Estado',
          label: 'Estado',
        },
        {
          key: 'UrlNormalizada',
          label: 'Enlace',
        },
        {
          key: 'Error',
          label: 'Error',
        },
      ] satisfies Array<{
        key: ColumnKey
        label: string
      }>,
    []
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (!q) return data

    return data.filter((r) =>
      [
        r.Archivo,
        r.CodigoGeneracion,
        r.FechaEmision,
        r.Ambiente,
        r.HostOriginal,
        r.Estado,
        r.UrlOriginal,
        r.UrlNormalizada,
        r.Error,
      ].some((v) =>
        String(v || '')
          .toLowerCase()
          .includes(q)
      )
    )
  }, [data, search])

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / rowsPerPage)
  )

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [
    filtered.length,
    rowsPerPage,
    totalPages,
    currentPage,
  ])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage

    return filtered.slice(
      start,
      start + rowsPerPage
    )
  }, [filtered, currentPage, rowsPerPage])

  const resumen = useMemo(() => {
    return {
      total: filtered.length,
      procesados: filtered.filter(
        (r) => r.Estado === 'PROCESADO'
      ).length,
      errores: filtered.filter(
        (r) => r.Estado === 'ERROR'
      ).length,
      admin: filtered.filter((r) =>
        r.HostOriginal.includes(
          'admin.factura.gob.sv'
        )
      ).length,
      webapp: filtered.filter((r) =>
        r.HostOriginal.includes(
          'webapp.dtes.mh.gob.sv'
        )
      ).length,
    }
  }, [filtered])

  const estadoPill = (estado?: string) => {
    switch (estado) {
      case 'PROCESADO':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'

      case 'ERROR':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'

      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  const renderValue = (
    row: QrPdfResultado,
    key: ColumnKey
  ) => {
    const value = row[key]

    if (key === 'Estado') {
      return (
        <span
          className={`px-2 py-0.5 rounded-full text-xs ${estadoPill(
            String(value)
          )}`}
        >
          {String(value || '')}
        </span>
      )
    }

    if (key === 'UrlNormalizada') {
      if (!value) return ''

      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          Abrir
        </a>
      )
    }

    return String(value || '')
  }

  return (
    <PlanGate routeKey="qr-pdf">
      <main className="w-full max-w-full dark:bg-background">
        <Card className="w-full max-w-full overflow-hidden border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <CardHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-white/10 dark:bg-zinc-950/90 dark:supports-[backdrop-filter]:bg-zinc-950/80">
            <CardTitle className="text-2xl text-slate-950 dark:text-white">
              Extractor QR desde PDF
            </CardTitle>

            <CardDescription className="text-slate-600 dark:text-zinc-300">
              Sube archivos PDF que contengan
              código QR de Hacienda para extraer
              código de generación, fecha de
              emisión y enlace normalizado.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <form
              onSubmit={onSubmit}
              className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black"
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
                <div className="space-y-2">
                  <Label htmlFor="file">
                    Archivos PDF
                  </Label>

                  <Input
                    id="file"
                    ref={inputRef}
                    type="file"
                    accept=".pdf,application/pdf"
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
                        Extraer
                      </>
                    )}
                  </Button>

                  {data.length > 0 && (
                    <Button
                      type="button"
                      onClick={() =>
                        descargarCsv(filtered)
                      }
                      className="w-full bg-yellow-400 font-bold text-black hover:bg-yellow-300 sm:w-auto"
                    >
                      Descargar CSV
                    </Button>
                  )}
                </div>
              </div>

              {progress && (
                <div className="rounded-md bg-yellow-100 p-3 text-sm text-yellow-900 dark:bg-yellow-400/15 dark:text-yellow-200">
                  {progress}
                </div>
              )}

              {msg && (
                <div
                  className={`text-sm rounded-md p-3 ${
                    msg.includes('finalizado')
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                      : msg.startsWith(
                            'Procesando'
                          )
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
                  Total
                </p>

                <p className="font-bold text-slate-950 dark:text-white">
                  {resumen.total}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Procesados
                </p>

                <p className="font-bold text-slate-950 dark:text-white">
                  {resumen.procesados}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Errores
                </p>

                <p className="font-bold text-slate-950 dark:text-white">
                  {resumen.errores}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Admin factura
                </p>

                <p className="font-bold text-slate-950 dark:text-white">
                  {resumen.admin}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Webapp DTE
                </p>

                <p className="font-bold text-slate-950 dark:text-white">
                  {resumen.webapp}
                </p>
              </div>
            </section>

            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="hidden sm:inline">
                  Resultados:
                </span>

                <span className="font-medium text-foreground">
                  {filtered.length}
                </span>

                {filtered.length !== data.length && (
                  <span className="text-xs">
                    (de {data.length} totales)
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative">
                  <Input
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="Buscar por archivo, código o fecha…"
                    className="pl-9 w-[280px]"
                  />

                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>

                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="rpp"
                    className="text-sm"
                  >
                    Filas
                  </Label>

                  <select
                    id="rpp"
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(
                        Number(e.target.value)
                      )

                      setCurrentPage(1)
                    }}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option
                        key={n}
                        value={n}
                      >
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
                    {paginatedData.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={
                            columnas.length
                          }
                          className="p-6 text-center text-muted-foreground"
                        >
                          {loading
                            ? 'Cargando…'
                            : 'Sin resultados para mostrar.'}
                        </td>
                      </tr>
                    )}

                    {paginatedData.map(
                      (r, i) => (
                        <tr
                          key={
                            r.CodigoGeneracion ||
                            r.Archivo ||
                            i
                          }
                          className="hover:bg-muted/40 transition-colors"
                        >
                          {columnas.map(
                            (col) => (
                              <td
                                key={
                                  col.key
                                }
                                className="p-2 align-top whitespace-nowrap"
                              >
                                {renderValue(
                                  r,
                                  col.key
                                )}
                              </td>
                            )
                          )}
                        </tr>
                      )
                    )}
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
                    onClick={() =>
                      setCurrentPage(1)
                    }
                    disabled={
                      currentPage === 1
                    }
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(
                        (p) =>
                          Math.max(
                            1,
                            p - 1
                          )
                      )
                    }
                    disabled={
                      currentPage === 1
                    }
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(
                        (p) =>
                          Math.min(
                            totalPages,
                            p + 1
                          )
                      )
                    }
                    disabled={
                      currentPage ===
                      totalPages
                    }
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(
                        totalPages
                      )
                    }
                    disabled={
                      currentPage ===
                      totalPages
                    }
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
