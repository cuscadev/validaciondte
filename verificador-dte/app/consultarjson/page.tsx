// app/consultarjson/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslation } from 'react-i18next'
import { toast, Toaster } from 'sonner'
import { Loader2, FileUp, Moon, Sun, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Search, ExternalLink } from 'lucide-react'

type Resultado = {
  ambiente: string
  codGen: string
  fechaEmi: string
  url: string
  estado: 'EMITIDO' | 'ANULADO' | 'RECHAZADO' | 'NO ENCONTRADO' | 'ERROR'
  descripcionEstado?: string
  error?: string

  tipoDte?: string
  numeroControl?: string
  emisorNit?: string
  emisorNrc?: string
  emisorNombre?: string
  receptorNit?: string
  receptorNrc?: string
  receptorNombre?: string
  montoTotalOperacion?: number
  totalPagar?: number
  iva?: number
}

export default function ConsultarJsonPage() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null)
  const [dark, setDark] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('') // Solo para compatibilidad visual, pero se usará toast
  const [data, setData] = useState<Resultado[]>([])

  // UIX
  const [search, setSearch] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  
  const toggleTheme = () => {
    setDark(d => !d)
    document.documentElement.classList.toggle('dark')
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const files = inputRef.current?.files
    if (!files || files.length === 0) {
      toast.error(t('consultarjson_selecciona_archivos'))
      setMsg(t('consultarjson_selecciona_archivos'))
      return
    }
    setLoading(true)
    toast.loading(t('consultarjson_procesando'))
    setMsg(t('consultarjson_procesando'))
    setData([])
    setCurrentPage(1)

    try {
      const fd = new FormData()
      Array.from(files).forEach(f => fd.append('files', f))

      const res = await fetch('/api/verificararchjson', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.text()
        toast.error(err || t('consultarjson_error'))
        setMsg(err || t('consultarjson_error'))
        throw new Error(err || t('consultarjson_error'))
      }

      const json = await res.json() as { resultados: Resultado[] }
      setData(json.resultados || [])
      toast.success(t('consultarjson_completada'))
      setMsg(t('consultarjson_completada'))
    } catch (e: any) {
      toast.error(e?.message || t('consultarjson_error'))
      setMsg(` ${e?.message || t('consultarjson_error')}`)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(r => {
      const campos = [
        r.codGen, r.estado, r.descripcionEstado, r.fechaEmi, r.tipoDte, r.numeroControl,
        r.emisorNombre, r.emisorNit, r.receptorNombre, r.receptorNit
      ]
      return campos.some(v => (v || '').toLowerCase().includes(q))
    })
  }, [data, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages) }, [filtered.length, rowsPerPage, totalPages, currentPage])
  useEffect(() => { setCurrentPage(1) }, [search])

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, currentPage, rowsPerPage])

  const estadoClass = (estado: Resultado['estado']) => ({
    'EMITIDO': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    'ANULADO': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    'RECHAZADO': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    'NO ENCONTRADO': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    'ERROR': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  }[estado] || '')

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted px-4 py-12 dark:bg-background">
      {/* Tema */}
      <Toaster position="top-right" richColors />
      <div className="absolute top-4 right-4">
        <Button variant="outline" onClick={toggleTheme}>
          {dark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
          {dark ? t('consultarjson_claro') : t('consultarjson_oscuro')}
        </Button>
      </div>

      <Card className="w-full max-w-7xl shadow-xl border-border/60">
        <CardHeader className="sticky top-0 z-10 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 rounded-t-xl">
          <CardTitle className="text-2xl">{t('consultarjson_title')}</CardTitle>
          <CardDescription>{t('consultarjson_desc')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={onSubmit} className="space-y-5 rounded-md border p-4 bg-background/50">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
              <div className="space-y-2">
                <Label htmlFor="file">{t('consultarjson_archivos')}</Label>
                <Input id="file" ref={inputRef} type="file" accept=".json" multiple />
              </div>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? (<><Loader2 className="animate-spin w-4 h-4 mr-2" />{t('consultarjson_verificando')}</>) : (<><FileUp className="w-4 h-4 mr-2" />{t('consultarjson_verificar')}</>)}
              </Button>
            </div>

            {/* msg visual fallback, pero ahora se usa Sonner */}
            {msg && (
              <div className={`text-sm rounded-md p-3 ${
                msg.startsWith('✅') ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                : msg.startsWith(t('consultarjson_procesando')) ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
              }`}>
                {msg}
              </div>
            )}
          </form>

          {/* Toolbar */}
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              {t('consultarjson_resultados')}: <span className="font-medium text-foreground">{filtered.length}</span>{filtered.length !== data.length && <> ({t('consultarjson_de')} {data.length} {t('consultarjson_totales')})</>}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="relative">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('consultarjson_buscar_placeholder')} className="pl-8 w-[280px]" />
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="rpp" className="text-sm">{t('consultarjson_filas')}</Label>
                <select id="rpp" value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1) }} className="h-9 rounded-md border bg-background px-2 text-sm">
                  {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="rounded-md border overflow-hidden">
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/70 sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-muted/50">
                  <tr>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_codigo')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_estado')}</th>
                    <th className="text-left p-2">{t('consultarjson_descripcion')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_fecha')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_tipo')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_control')}</th>
                    <th className="text-left p-2">{t('consultarjson_emisor')}</th>
                    <th className="text-left p-2">{t('consultarjson_receptor')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_monto')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_total')}</th>
                    <th className="text-left p-2 whitespace-nowrap">{t('consultarjson_iva')}</th>
                    <th className="text-left p-2">{t('consultarjson_enlace')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p-6 text-center text-muted-foreground">
                        {loading ? t('consultarjson_cargando') : t('consultarjson_sin_resultados')}
                      </td>
                    </tr>
                  )}

                  {paginated.map((r, i) => (
                    <tr key={`${r.codGen}-${i}`} className="hover:bg-muted/40 transition-colors">
                      <td className="p-2 whitespace-nowrap">{r.codGen}</td>
                      <td className="p-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${estadoClass(r.estado)}`}>{r.estado}</span>
                      </td>
                      <td className="p-2">{r.descripcionEstado || r.error || '-'}</td>
                      <td className="p-2 whitespace-nowrap">{r.fechaEmi}</td>
                      <td className="p-2 whitespace-nowrap">{r.tipoDte || '-'}</td>
                      <td className="p-2 whitespace-nowrap">{r.numeroControl || '-'}</td>
                      <td className="p-2">
                        <div className="leading-tight">
                          <div className="font-medium">{r.emisorNombre || '-'}</div>
                          <div className="text-xs text-muted-foreground">NIT {r.emisorNit || '-'} · NRC {r.emisorNrc || '-'}</div>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="leading-tight">
                          <div className="font-medium">{r.receptorNombre || '-'}</div>
                          <div className="text-xs text-muted-foreground">NIT {r.receptorNit || '-'} · NRC {r.receptorNrc || '-'}</div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">{r.montoTotalOperacion?.toFixed(2) ?? '-'}</td>
                      <td className="p-2 whitespace-nowrap">{r.totalPagar?.toFixed(2) ?? '-'}</td>
                      <td className="p-2 whitespace-nowrap">{r.iva?.toFixed(2) ?? '-'}</td>
                      <td className="p-2">
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 underline text-xs">
                            {t('consultarjson_ver')} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginador */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2 border-t bg-background/60">
              <span className="text-sm text-muted-foreground">
                {t('consultarjson_pagina')} <span className="font-medium text-foreground">{currentPage}</span> {t('consultarjson_de2')} {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}><ChevronsLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}><ChevronsRight className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
