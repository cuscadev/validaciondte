'use client';

import { BouncingDotsLoader } from '@/components/ui/bouncing-dots-loader';
import type { DteProcessingStats } from '@/lib/upload-dte-stats';
import { cn } from '@/lib/utils';
type UploadProcessingPanelProps = {
  phase: 'loading' | 'summary';
  stats?: DteProcessingStats | null;
  density?: 'full' | 'compact';
  className?: string;
};

const summaryItems = [
  { key: 'processed', label: 'Procesados', tone: 'neutral' },
  { key: 'conAjuste', label: 'Con ajuste', tone: 'amber' },
  { key: 'sinAjuste', label: 'Sin ajuste', tone: 'green' },
  { key: 'errores', label: 'Erróneos', tone: 'red' },
] as const;

const toneClasses = {
  neutral:
    'border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-zinc-950 dark:text-white',
  amber:
    'border-yellow-200/80 bg-yellow-50/70 text-yellow-900 dark:border-yellow-400/25 dark:bg-yellow-400/10 dark:text-yellow-100',
  red:
    'border-red-200/80 bg-red-50/70 text-red-900 dark:border-red-400/25 dark:bg-red-950/30 dark:text-red-100',
  green:
    'border-emerald-200/80 bg-emerald-50/70 text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-950/30 dark:text-emerald-100',
} as const;

export default function UploadProcessingPanel({
  phase,
  stats,
  density = 'full',
  className,
}: UploadProcessingPanelProps) {
  const isCompact = density === 'compact';
  if (phase === 'summary' && stats) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Resumen del procesamiento"
        className={cn(
          'flex w-full flex-col items-center justify-center',
          isCompact ? 'gap-2' : 'gap-3',
          className
        )}
      >
        <p className="text-center text-sm font-medium text-muted-foreground">
          Resumen del procesamiento
        </p>
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {summaryItems.map((item) => (
            <div
              key={item.key}
              className={cn(
                'rounded-lg border text-center',
                isCompact ? 'px-2 py-2' : 'px-3 py-3',
                toneClasses[item.tone]
              )}
            >
              <p
                className={cn(
                  'font-bold tabular-nums',
                  isCompact ? 'text-lg' : 'text-2xl'
                )}
              >
                {stats[item.key]}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Procesando documentos"
      className={cn(
        'flex w-full flex-col items-center justify-center gap-3',
        className
      )}
    >
      <BouncingDotsLoader size="md" label="Procesando documentos" />
      <p className="text-sm font-medium text-muted-foreground">Procesando documentos…</p>
    </div>
  );
}
