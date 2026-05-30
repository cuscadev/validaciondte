'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { QRCodeCanvas } from 'qrcode.react'
import {
  Download,
  FileArchive,
  FileJson,
  Image as ImageIcon,
  Loader2,
  Palette,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import PlanGate from '@/components/PlanGate'
import { useAuth } from '@/components/AuthProvider'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MAX_JSON_FILES = 25

type TemplateId = 'clasica' | 'moderna' | 'minimalista' | 'personalizada'
type LogoMode = 'profile' | 'upload' | 'none'
type TemplateColorKey = 'accent' | 'dark' | 'soft'

type DteJson = {
  identificacion?: Record<string, unknown>
  emisor?: Record<string, unknown>
  receptor?: Record<string, unknown>
  cuerpoDocumento?: Array<Record<string, unknown>>
  resumen?: Record<string, unknown>
  selloRecibido?: string
  selloRecepcion?: string
  respuestaHacienda?: Record<string, unknown>
  responseHacienda?: Record<string, unknown>
}

type PdfResult = {
  sourceName: string
  tipoDte: string
  codigoGeneracion: string
  estado: 'GENERADO' | 'ERROR'
  fileName: string
  blob?: Blob
  error?: string
}

type PdfTemplate = {
  id: TemplateId
  name: string
  description: string
  accent: string
  dark: string
  soft: string
}

const templates: PdfTemplate[] = [
  {
    id: 'clasica',
    name: 'Clásica',
    description: 'Formato sobrio para documentos fiscales y despacho contable.',
    accent: '#facc15',
    dark: '#111827',
    soft: '#f8fafc',
  },
  {
    id: 'moderna',
    name: 'Moderna',
    description: 'Encabezado visual, bloques limpios y énfasis en totales.',
    accent: '#22c55e',
    dark: '#0f172a',
    soft: '#ecfdf5',
  },
  {
    id: 'minimalista',
    name: 'Minimalista',
    description: 'Diseño claro, compacto y sin ruido para lectura rápida.',
    accent: '#38bdf8',
    dark: '#18181b',
    soft: '#f0f9ff',
  },
]

const defaultCustomTemplate: PdfTemplate = {
  id: 'personalizada',
  name: 'Personalizada',
  description: 'Configura colores para adaptar el PDF a la marca del cliente.',
  accent: '#facc15',
  dark: '#111827',
  soft: '#f8fafc',
}

const tipoDteLabels: Record<string, string> = {
  '01': 'Factura',
  '03': 'Comprobante de Crédito Fiscal',
  '04': 'Nota de Remisión',
  '05': 'Nota de Crédito',
  '06': 'Nota de Débito',
  '07': 'Comprobante de Retención',
  '11': 'Factura de Exportación',
  '14': 'Factura de Sujeto Excluido',
  '15': 'Comprobante de Donación',
}

const getString = (value: unknown, fallback = '') => {
  if (value === null || value === undefined) return fallback
  return String(value)
}

const getNumber = (value: unknown) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const money = (value: unknown) =>
  getNumber(value).toLocaleString('es-SV', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })

const sanitizeFileName = (value: string) =>
  value
    .replace(/\.json$/i, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 80)

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('No se pudo leer el logo.'))
    reader.readAsDataURL(file)
  })

const imageUrlToDataUrl = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo cargar el logo del perfil.')
  const blob = await res.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('No se pudo preparar el logo.'))
    reader.readAsDataURL(blob)
  })
}

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const u16 = (value: number) => {
  const out = new Uint8Array(2)
  new DataView(out.buffer).setUint16(0, value, true)
  return out
}

const u32 = (value: number) => {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setUint32(0, value >>> 0, true)
  return out
}

const concatBytes = (parts: Uint8Array[]) => {
  const size = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const createZip = async (files: Array<{ name: string; blob: Blob }>) => {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const content = new Uint8Array(await file.blob.arrayBuffer())
    const crc = crc32(content)

    const local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(content.length),
      u32(content.length),
      u16(name.length),
      u16(0),
      name,
      content,
    ])

    locals.push(local)

    centrals.push(
      concatBytes([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(content.length),
        u32(content.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ])
    )

    offset += local.length
  }

  const central = concatBytes(centrals)
  const local = concatBytes(locals)
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(local.length),
    u16(0),
  ])

  return new Blob([local, central, end], { type: 'application/zip' })
}

const buildHaciendaUrl = (dte: DteJson) => {
  const identificacion = dte.identificacion || {}
  const codigoGeneracion = getString(identificacion.codigoGeneracion)
  const fechaEmi = getString(identificacion.fecEmi)
  const ambiente = getString(identificacion.ambiente, '01')

  if (!codigoGeneracion || !fechaEmi) return ''

  const params = new URLSearchParams({
    ambiente,
    codGen: codigoGeneracion,
    fechaEmi,
  })

  return `https://admin.factura.gob.sv/consultaPublica?${params.toString()}`
}

const getSello = (dte: DteJson) =>
  getString(
    dte.selloRecibido ||
      dte.selloRecepcion ||
      dte.respuestaHacienda?.selloRecibido ||
      dte.respuestaHacienda?.selloRecepcion ||
      dte.responseHacienda?.selloRecibido ||
      dte.responseHacienda?.selloRecepcion
  )

const drawLabelValue = (
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) => {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(label.toUpperCase(), x, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(17, 24, 39)
  doc.text(doc.splitTextToSize(value || '-', width), x, y + 13)
}

const addFooter = (doc: jsPDF, template: PdfTemplate) => {
  const pageCount = doc.getNumberOfPages()
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(template.accent)
    doc.line(40, height - 34, width - 40, height - 34)
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(
      `PDF generado localmente en el navegador - página ${i} de ${pageCount}`,
      40,
      height - 18
    )
  }
}

const generatePdf = ({
  dte,
  template,
  logoDataUrl,
  qrDataUrl,
}: {
  dte: DteJson
  template: PdfTemplate
  logoDataUrl: string
  qrDataUrl: string
}) => {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const identificacion = dte.identificacion || {}
  const emisor = dte.emisor || {}
  const receptor = dte.receptor || {}
  const resumen = dte.resumen || {}
  const cuerpo = Array.isArray(dte.cuerpoDocumento) ? dte.cuerpoDocumento : []
  const width = doc.internal.pageSize.getWidth()

  const tipoDte = getString(identificacion.tipoDte)
  const tipoLabel = tipoDteLabels[tipoDte] || `DTE ${tipoDte || '-'}`
  const codigoGeneracion = getString(identificacion.codigoGeneracion)
  const numeroControl = getString(identificacion.numeroControl)
  const sello = getSello(dte)
  const link = buildHaciendaUrl(dte)

  doc.setFillColor(template.dark)
  doc.rect(0, 0, width, 118, 'F')
  doc.setFillColor(template.accent)
  doc.rect(0, 0, width, 6, 'F')

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 42, 26, 64, 64, undefined, 'FAST')
    } catch {
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(42, 26, 64, 64, 6, 6, 'F')
    }
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(template.id === 'minimalista' ? 18 : 22)
  doc.text(tipoLabel, logoDataUrl ? 124 : 42, 48)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Generado: ${getString(identificacion.fecEmi)} ${getString(identificacion.horEmi)}`, logoDataUrl ? 124 : 42, 68)
  doc.text(`Número de control: ${numeroControl || '-'}`, logoDataUrl ? 124 : 42, 86)

  doc.setFillColor(template.soft)
  doc.roundedRect(40, 138, width - 80, 92, 8, 8, 'F')
  drawLabelValue(doc, 'Código de generación', codigoGeneracion, 58, 160, 230)
  drawLabelValue(doc, 'Sello recibido', sello, 310, 160, 230)
  drawLabelValue(doc, 'Ambiente', getString(identificacion.ambiente, '01'), 58, 202, 120)
  drawLabelValue(doc, 'Modelo / operación', `${getString(identificacion.modelo)} / ${getString(identificacion.tipoOperacion)}`, 190, 202, 160)
  drawLabelValue(doc, 'Moneda', getString(resumen.codigoMoneda, 'USD'), 370, 202, 80)

  autoTable(doc, {
    startY: 252,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 252 },
      1: { cellWidth: 252 },
    },
    body: [
      [
        {
          content: `EMISOR\n${getString(emisor.nombre)}\nNIT: ${getString(emisor.nit)}\nNRC: ${getString(emisor.nrc)}\n${getString(emisor.direccion && typeof emisor.direccion === 'object' ? (emisor.direccion as Record<string, unknown>).complemento : '')}`,
          styles: { fillColor: [248, 250, 252], textColor: [17, 24, 39] },
        },
        {
          content: `RECEPTOR\n${getString(receptor.nombre)}\nNIT/DUI: ${getString(receptor.nit || receptor.numDocumento)}\nNRC: ${getString(receptor.nrc)}\n${getString(receptor.direccion && typeof receptor.direccion === 'object' ? (receptor.direccion as Record<string, unknown>).complemento : '')}`,
          styles: { fillColor: [248, 250, 252], textColor: [17, 24, 39] },
        },
      ],
    ],
  })

  const itemsY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 360

  autoTable(doc, {
    startY: itemsY + 22,
    head: [['Cant.', 'Descripción', 'Precio', 'Descuento', 'Total']],
    body: cuerpo.map((item) => [
      getString(item.cantidad || item.cantidadItem || '1'),
      getString(item.descripcion || item.desc || item.nombre || 'Item'),
      money(item.precioUni || item.precioUnitario || item.montoDescu || 0),
      money(item.montoDescu || item.descuento || 0),
      money(item.ventaGravada || item.ventaExenta || item.ventaNoSuj || item.montoItem || 0),
    ]),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: {
      fillColor: template.dark,
      textColor: '#ffffff',
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 44, halign: 'right' },
      1: { cellWidth: 250 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  })

  const totalsY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 560
  const boxY = Math.min(totalsY + 24, 646)

  doc.setFillColor(template.soft)
  doc.roundedRect(width - 252, boxY, 212, 98, 8, 8, 'F')
  doc.setFontSize(9)
  doc.setTextColor(17, 24, 39)

  const totalRows = [
    ['Subtotal', money(resumen.subTotalVentas || resumen.subTotal || 0)],
    ['IVA / tributos', money(resumen.totalIva || resumen.ivaRete1 || resumen.tributos || 0)],
    ['Descuentos', money(resumen.totalDescu || 0)],
    ['Total a pagar', money(resumen.totalPagar || resumen.montoTotalOperacion || resumen.totalGravada || 0)],
  ]

  totalRows.forEach(([label, value], index) => {
    const y = boxY + 20 + index * 18
    doc.setFont('helvetica', index === totalRows.length - 1 ? 'bold' : 'normal')
    doc.text(label, width - 232, y)
    doc.text(value, width - 58, y, { align: 'right' })
  })

  if (link) {
    if (qrDataUrl) {
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(40, boxY, 86, 86, 6, 6, 'F')
      doc.addImage(qrDataUrl, 'PNG', 46, boxY + 6, 74, 74, undefined, 'FAST')
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(37, 99, 235)
    doc.textWithLink('Consultar documento en Hacienda', qrDataUrl ? 138 : 40, boxY + 22, { url: link })
  }

  addFooter(doc, template)
  return doc.output('blob')
}

export default function PlantillasPdfPage() {
  const { appUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const qrRequestIdRef = useRef(0)
  const qrPendingRef = useRef<{
    resolve: (value: string) => void
    reject: (error: Error) => void
  } | null>(null)

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('clasica')
  const [customTemplate, setCustomTemplate] = useState<PdfTemplate>(defaultCustomTemplate)
  const [logoMode, setLogoMode] = useState<LogoMode>('profile')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [jsonFiles, setJsonFiles] = useState<File[]>([])
  const [results, setResults] = useState<PdfResult[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [qrRequest, setQrRequest] = useState<{ id: number; value: string } | null>(null)

  const template = useMemo(
    () =>
      selectedTemplate === 'personalizada'
        ? customTemplate
        : templates.find((item) => item.id === selectedTemplate) || templates[0],
    [customTemplate, selectedTemplate]
  )

  const templateOptions = useMemo(() => [...templates, customTemplate], [customTemplate])

  useEffect(() => {
    if (!qrRequest || !qrPendingRef.current) return

    const frame = window.requestAnimationFrame(() => {
      const pending = qrPendingRef.current
      qrPendingRef.current = null

      try {
        const canvas = qrCanvasRef.current
        if (!canvas) throw new Error('No se pudo generar el QR de Hacienda.')
        pending?.resolve(canvas.toDataURL('image/png'))
      } catch (error) {
        pending?.reject(error instanceof Error ? error : new Error('No se pudo generar el QR de Hacienda.'))
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [qrRequest])

  const createQrDataUrl = useCallback((value: string) => {
    if (!value) return Promise.resolve('')

    return new Promise<string>((resolve, reject) => {
      qrPendingRef.current = { resolve, reject }
      qrRequestIdRef.current += 1
      setQrRequest({ id: qrRequestIdRef.current, value })
    })
  }, [])

  const generated = results.filter((item) => item.estado === 'GENERADO' && item.blob)
  const errors = results.filter((item) => item.estado === 'ERROR')

  const handleJsonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.name.toLowerCase().endsWith('.json')
    )

    setResults([])

    if (files.length > MAX_JSON_FILES) {
      setMessage(`Selecciona máximo ${MAX_JSON_FILES} archivos JSON por proceso.`)
      setJsonFiles(files.slice(0, MAX_JSON_FILES))
      return
    }

    setMessage('')
    setJsonFiles(files)
  }

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMessage('El logo debe ser una imagen.')
      return
    }

    setLogoFile(file)
    setLogoMode('upload')
    setMessage('')
  }

  const resolveLogo = async () => {
    if (logoMode === 'none') return ''
    if (logoMode === 'upload') {
      if (!logoFile) return ''
      return fileToDataUrl(logoFile)
    }
    if (!appUser?.photoURL) return ''
    return imageUrlToDataUrl(appUser.photoURL)
  }

  const processFiles = async () => {
    if (!jsonFiles.length) {
      setMessage('Selecciona uno o varios JSON DTE.')
      return
    }

    setLoading(true)
    setMessage('Generando PDFs en memoria...')
    setResults([])

    let logoDataUrl = ''
    try {
      logoDataUrl = await resolveLogo()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar el logo.')
      if (logoMode === 'profile') logoDataUrl = ''
    }

    const nextResults: PdfResult[] = []

    for (const file of jsonFiles) {
      try {
        const dte = JSON.parse(await file.text()) as DteJson
        const identificacion = dte.identificacion || {}
        const tipoDte = getString(identificacion.tipoDte)
        const codigoGeneracion = getString(identificacion.codigoGeneracion)
        const baseName = sanitizeFileName(codigoGeneracion || file.name)
        const qrDataUrl = await createQrDataUrl(buildHaciendaUrl(dte))
        const blob = generatePdf({ dte, template, logoDataUrl, qrDataUrl })

        nextResults.push({
          sourceName: file.name,
          tipoDte: tipoDteLabels[tipoDte] || tipoDte || 'Sin tipo',
          codigoGeneracion,
          estado: 'GENERADO',
          fileName: `${baseName || 'dte'}_${template.id}.pdf`,
          blob,
        })
      } catch (error) {
        nextResults.push({
          sourceName: file.name,
          tipoDte: '',
          codigoGeneracion: '',
          estado: 'ERROR',
          fileName: '',
          error: error instanceof Error ? error.message : 'JSON inválido',
        })
      }
    }

    setResults(nextResults)
    setLoading(false)
    setMessage(
      nextResults.some((item) => item.estado === 'ERROR')
        ? 'Proceso finalizado con errores en algunos archivos.'
        : 'PDFs generados correctamente. No se guardó ningún archivo en el servidor.'
    )
  }

  const downloadAll = async () => {
    if (!generated.length) return
    if (generated.length === 1 && generated[0].blob) {
      downloadBlob(generated[0].blob, generated[0].fileName)
      return
    }

    const zip = await createZip(
      generated
        .filter((item): item is PdfResult & { blob: Blob } => !!item.blob)
        .map((item) => ({ name: item.fileName, blob: item.blob }))
    )

    downloadBlob(zip, `plantillas_pdf_${new Date().toISOString().slice(0, 10)}.zip`)
  }

  return (
    <PlanGate routeKey="plantillas-pdf">
      <div aria-hidden="true" className="fixed -left-[10000px] top-0 h-[180px] w-[180px] overflow-hidden">
        {qrRequest?.value && (
          <QRCodeCanvas
            key={qrRequest.id}
            ref={qrCanvasRef}
            value={qrRequest.value}
            size={180}
            level="M"
            marginSize={2}
            bgColor="#ffffff"
            fgColor="#111827"
          />
        )}
      </div>
      <main className="w-full max-w-full dark:bg-background">
        <Card className="w-full max-w-full overflow-hidden border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <CardHeader className="border-b border-slate-200 bg-white/90 dark:border-white/10 dark:bg-zinc-950/90">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl text-slate-950 dark:text-white">
                  <Palette className="size-6 text-amber-500" />
                  Plantillas PDF
                </CardTitle>
                <CardDescription className="mt-2 max-w-3xl text-slate-600 dark:text-zinc-300">
                  Genera PDFs personalizados desde JSON DTE con logo, diseño profesional y descarga local.
                  Los documentos se procesan en memoria y no se guardan en el servidor.
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit gap-2 px-3 py-1">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                Privado por diseño
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-4 md:p-6">
            <section className="grid gap-4 lg:grid-cols-4">
              {templateOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedTemplate(item.id)}
                  className={`rounded-lg border p-4 text-left transition ${
                    selectedTemplate === item.id
                      ? 'border-yellow-400 bg-yellow-50 shadow-sm dark:bg-yellow-400/10'
                      : 'border-slate-200 bg-slate-50 hover:border-yellow-300 dark:border-white/10 dark:bg-black'
                  }`}
                >
                  <div
                    className="mb-4 h-28 rounded-md border bg-white p-3"
                    style={{ borderColor: item.accent }}
                  >
                    <div className="mb-3 h-5 rounded-sm" style={{ backgroundColor: item.dark }} />
                    <div className="h-3 w-3/4 rounded-sm" style={{ backgroundColor: item.accent }} />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="h-12 rounded-sm" style={{ backgroundColor: item.soft }} />
                      <div className="h-12 rounded-sm" style={{ backgroundColor: item.soft }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-semibold text-slate-950 dark:text-white">{item.name}</h2>
                    {selectedTemplate === item.id && <Badge>Activa</Badge>}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </button>
              ))}
            </section>

            {selectedTemplate === 'personalizada' && (
              <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
                <div className="flex items-center gap-2">
                  <Palette className="size-5 text-amber-500" />
                  <h2 className="font-semibold text-slate-950 dark:text-white">DiseÃ±o personalizado</h2>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {[
                    { key: 'accent' as TemplateColorKey, label: 'Color de acento' },
                    { key: 'dark' as TemplateColorKey, label: 'Encabezado' },
                    { key: 'soft' as TemplateColorKey, label: 'Fondo de bloques' },
                  ].map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={`custom-${field.key}`}>{field.label}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`custom-${field.key}`}
                          type="color"
                          value={customTemplate[field.key]}
                          onChange={(event) =>
                            setCustomTemplate((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          className="h-10 w-14 cursor-pointer p-1"
                        />
                        <Input
                          value={customTemplate[field.key]}
                          onChange={(event) =>
                            setCustomTemplate((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          className="bg-white font-mono text-sm dark:bg-zinc-950"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
                <div className="flex items-center gap-2">
                  <ImageIcon className="size-5 text-amber-500" />
                  <h2 className="font-semibold text-slate-950 dark:text-white">Logo para este PDF</h2>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { key: 'profile', label: 'Usar foto/logo del perfil' },
                    { key: 'upload', label: 'Subir logo temporal' },
                    { key: 'none', label: 'No usar logo' },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setLogoMode(option.key as LogoMode)
                        if (option.key === 'upload') logoInputRef.current?.click()
                      }}
                      className={`min-h-16 rounded-md border px-3 py-2 text-sm font-medium transition ${
                        logoMode === option.key
                          ? 'border-yellow-400 bg-yellow-50 text-slate-950 dark:bg-yellow-400/10 dark:text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <Input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />

                <p className="text-sm text-muted-foreground">
                  {logoMode === 'profile'
                    ? appUser?.photoURL
                      ? 'Se usará la imagen del perfil solo como entrada temporal.'
                      : 'Tu perfil no tiene imagen; el PDF se generará sin logo.'
                    : logoMode === 'upload'
                      ? logoFile
                        ? `Logo temporal: ${logoFile.name}`
                        : 'Selecciona una imagen. No reemplazará la foto del perfil.'
                      : 'El PDF se generará sin logo.'}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-amber-500" />
                  <h2 className="font-semibold text-slate-950 dark:text-white">Plantilla seleccionada</h2>
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-950 dark:text-white">{template.name}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{template.description}</p>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="jsonFiles">JSON DTE</Label>
                  <Input
                    id="jsonFiles"
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    multiple
                    onChange={handleJsonChange}
                    className="bg-white dark:bg-zinc-950"
                  />
                  <p className="text-xs text-muted-foreground">
                    Puedes procesar 1 JSON o un lote de hasta {MAX_JSON_FILES} archivos.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    disabled={loading || !jsonFiles.length}
                    onClick={processFiles}
                    className="h-10 bg-yellow-400 font-bold text-black hover:bg-yellow-300"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Generando
                      </>
                    ) : (
                      <>
                        <FileJson className="size-4" />
                        Generar PDFs
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={!generated.length}
                    onClick={downloadAll}
                    className="h-10"
                  >
                    <FileArchive className="size-4" />
                    {generated.length > 1 ? 'Descargar ZIP' : 'Descargar PDF'}
                  </Button>
                </div>
              </div>

              {message && (
                <p
                  className={`mt-4 rounded-md px-3 py-2 text-sm ${
                    message.includes('error') || message.includes('máximo')
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                  }`}
                >
                  {message}
                </p>
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-muted-foreground">Archivos seleccionados</p>
                <p className="text-xl font-bold">{jsonFiles.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-muted-foreground">PDFs generados</p>
                <p className="text-xl font-bold">{generated.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="text-xs text-muted-foreground">Errores</p>
                <p className="text-xl font-bold">{errors.length}</p>
              </div>
            </section>

            <div className="overflow-hidden rounded-md border border-slate-200 dark:border-white/10">
              <div className="max-h-[54vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-950 dark:bg-zinc-900 dark:text-zinc-100">
                    <tr>
                      <th className="p-2 text-left font-semibold">Archivo JSON</th>
                      <th className="p-2 text-left font-semibold">Tipo DTE</th>
                      <th className="p-2 text-left font-semibold">Código generación</th>
                      <th className="p-2 text-left font-semibold">Estado</th>
                      <th className="p-2 text-left font-semibold">Descargar PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!results.length && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          Genera PDFs para ver los resultados.
                        </td>
                      </tr>
                    )}

                    {results.map((item) => (
                      <tr key={`${item.sourceName}-${item.codigoGeneracion || item.error}`}>
                        <td className="p-2 align-top">{item.sourceName}</td>
                        <td className="p-2 align-top">{item.tipoDte || '-'}</td>
                        <td className="p-2 align-top font-mono text-xs">{item.codigoGeneracion || '-'}</td>
                        <td className="p-2 align-top">
                          <Badge variant={item.estado === 'GENERADO' ? 'default' : 'destructive'}>
                            {item.estado}
                          </Badge>
                          {item.error && <p className="mt-1 text-xs text-red-600">{item.error}</p>}
                        </td>
                        <td className="p-2 align-top">
                          {item.blob ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => downloadBlob(item.blob!, item.fileName)}
                            >
                              <Download className="size-4" />
                              PDF
                            </Button>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </PlanGate>
  )
}
