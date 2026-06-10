// app/consultarjson/page.tsx
'use client'

import { useState } from 'react'
import UploadFormSection from '@/components/upload/UploadFormSection'
import UploadFormAccordion from '@/components/upload/UploadFormAccordion'
import UploadResultsReveal from '@/components/upload/UploadResultsReveal'
import DteJsonResultsTable from '@/components/dte/DteJsonResultsTable'
import { useUploadResultsReveal } from '@/components/upload/useUploadResultsReveal'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { recordProcessingLog } from '@/lib/client-processing-log'
import { summarizeFiles, summarizeResults } from '@/lib/processing-log'
import { summarizeDteUploadResults } from '@/lib/upload-dte-stats'
import type { DteJsonResultado } from '@/lib/dte-json-result'

export default function ConsultarJsonPage() {
  const { t } = useTranslation();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DteJsonResultado[]>([])

  const {
    resultsVisible,
    accordionApiRef,
    resetResultsVisibility,
    onResultsReveal,
  } = useUploadResultsReveal()
  
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedFiles.length === 0) {
      toast.warning(t('consultarjson_selecciona_archivos'))
      return
    }
    setLoading(true)
    resetResultsVisibility()
    setData([])
    const startedAt = new Date()
    const started = performance.now()

    try {
      const fd = new FormData()
      selectedFiles.forEach(f => fd.append('files', f))

      const res = await fetch('/api/verificararchjson', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || t('consultarjson_error'))
      }

      const json = await res.json() as { resultados: DteJsonResultado[] }
      setData(json.resultados || [])
      accordionApiRef.current?.setProcessingSummary(
        summarizeDteUploadResults(json.resultados || [])
      )
      toast.success(t('consultarjson_completada'))
      await recordProcessingLog({
        routeKey: 'consultarjson',
        moduleName: 'Consultar JSON',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: summarizeFiles(selectedFiles),
        ...summarizeResults(json.resultados || []),
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('consultarjson_error')
      toast.error(message)
      await recordProcessingLog({
        routeKey: 'consultarjson',
        moduleName: 'Consultar JSON',
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: summarizeFiles(selectedFiles),
        totalRecords: 0,
        successCount: 0,
        errorCount: selectedFiles.length || 1,
        statusBreakdown: { ERROR: selectedFiles.length || 1 },
        outcome: 'error',
        errorMessage: message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted px-4 py-12 dark:bg-background">

      <Card className="w-full max-w-7xl shadow-xl border-border/60">
        <CardContent className="space-y-6 pt-6">
          <form onSubmit={onSubmit} className="overflow-hidden rounded-md border border-border/60">
            <UploadFormAccordion
              accordionApiRef={accordionApiRef}
              onResultsReveal={onResultsReveal}
              hasResults={resultsVisible && data.length > 0}
              collapseWhenResults
            >
            <UploadFormSection
              label={t('consultarjson_archivos')}
              briefHint="JSON de DTE"
              helpContent={t('consultarjson_desc')}
              files={selectedFiles}
              onFilesChange={setSelectedFiles}
              loading={loading}
              submitLabel={t('consultarjson_verificar')}
              loadingLabel={t('consultarjson_verificando')}
              submitClassName="w-full sm:w-auto"
              accept={{ 'application/json': ['.json'] }}
            />

            </UploadFormAccordion>
          </form>

          <UploadResultsReveal visible={resultsVisible && data.length > 0}>
            <DteJsonResultsTable results={data} loading={loading} profile="consultarjson" />
          </UploadResultsReveal>
        </CardContent>
      </Card>
    </main>
  )
}
