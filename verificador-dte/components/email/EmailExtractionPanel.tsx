'use client';

import { Loader2 } from 'lucide-react';

import EmailExtractionTable from '@/components/email/EmailExtractionTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BouncingDotsLoader } from '@/components/ui/bouncing-dots-loader';
import { Progress } from '@/components/ui/progress';
import type { EmailSyncJobResultRow } from '@/lib/supabase-admin';

type SyncJob = {
  id: string;
  status: string;
  found_count: number;
  imported_count: number;
  skipped_count: number;
  error_count: number;
};

type Props = {
  job: SyncJob | null;
  results: EmailSyncJobResultRow[];
  syncing: boolean;
  consulting?: boolean;
  consultableCount?: number;
  progressValue: number;
  phase: 'running' | 'completed';
  onConfirmConsult: (wantsConsult: boolean) => void;
  onChooseDocuments?: () => void;
};

export default function EmailExtractionPanel({
  job,
  results,
  syncing,
  consulting = false,
  consultableCount = 0,
  progressValue,
  phase,
  onConfirmConsult,
  onChooseDocuments,
}: Props) {
  const allDuplicates =
    job &&
    job.found_count > 0 &&
    job.imported_count === 0 &&
    job.skipped_count >= job.found_count;

  const showExtractionLoader = syncing && phase === 'running';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {phase === 'running' ? 'Extracción en servidor (Go)' : 'Extracción completada'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {phase === 'running' ? (
          <p className="text-sm text-muted-foreground">
            La extracción se ejecuta en el backend Go (IMAP, descarga y parseo). Esta página
            espera el resultado; no hace consultas repetidas.
          </p>
        ) : (
          <p className="text-sm">
            Se guardaron <strong>{job?.imported_count ?? 0}</strong> documento(s) importados y se
            omitieron <strong>{job?.skipped_count ?? 0}</strong>.
          </p>
        )}

        {job && !showExtractionLoader ? (
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Backend Go
              </span>
              <span>
                Encontrados: <strong>{job.found_count}</strong>
              </span>
              <span>
                Importados: <strong>{job.imported_count}</strong>
              </span>
              <span>
                Omitidos: <strong>{job.skipped_count}</strong>
              </span>
              <span>
                Errores: <strong>{job.error_count}</strong>
              </span>
            </div>
            {phase === 'running' ? <Progress value={progressValue} /> : null}
          </div>
        ) : null}

        {showExtractionLoader ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Extrayendo adjuntos"
            className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border/60 bg-muted/10 py-10"
          >
            <BouncingDotsLoader size="md" label="Extrayendo adjuntos en el servidor" />
            <p className="text-sm font-medium text-muted-foreground">
              Extrayendo adjuntos en el servidor…
            </p>
          </div>
        ) : (
          <>
            {allDuplicates ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-950">
                {job?.found_count} adjunto(s) encontrados; todos ya estaban en el catálogo.
                {consultableCount > 0
                  ? ' Puede consultarlos en Hacienda desde el catálogo existente.'
                  : null}
              </p>
            ) : null}

            <EmailExtractionTable
              results={results}
              emptyMessage="Sin adjuntos procesados en esta extracción."
            />
          </>
        )}

        {phase === 'completed' ? (
          <>
            <p className="text-sm font-medium">¿Desea consultarlos en Hacienda ahora?</p>
            {allDuplicates && consultableCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Se consultarán {consultableCount} documento(s) ya existentes en el catálogo.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={consulting || consultableCount === 0}
                onClick={() => onConfirmConsult(true)}
              >
                {consulting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Sí, consultar en Hacienda
              </Button>
              {onChooseDocuments && consultableCount > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={consulting}
                  onClick={onChooseDocuments}
                >
                  Elegir documentos
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={consulting}
                onClick={() => onConfirmConsult(false)}
              >
                No, guardar y salir
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
