'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileJson, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

type PreviewMeta = {
  codigoGeneracion?: string;
  numeroControl?: string;
  totalPagar?: number;
  tipoDte?: string;
};

type Props = {
  disabled?: boolean;
  loadPreview: () => Promise<{ dteJson: unknown } & PreviewMeta>;
  className?: string;
  title?: string;
  description?: string;
  autoLoad?: boolean;
};

function formatMoney(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);
}

export function DteHaciendaJsonPreview({
  disabled = false,
  loadPreview,
  className,
  title = 'JSON completo para Hacienda',
  description = 'Vista previa del documento antes de firmar y transmitir. No consume correlativo.',
  autoLoad = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<PreviewMeta | null>(null);
  const [dteJson, setDteJson] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loadPreview();
      setDteJson(result.dteJson);
      setMeta({
        codigoGeneracion: result.codigoGeneracion,
        numeroControl: result.numeroControl,
        totalPagar: result.totalPagar,
        tipoDte: result.tipoDte,
      });
      setLoaded(true);
    } catch (err) {
      setDteJson(null);
      setMeta(null);
      setError(err instanceof Error ? err.message : 'No se pudo generar la vista previa');
    } finally {
      setLoading(false);
    }
  }, [loadPreview]);

  useEffect(() => {
    if (!autoLoad || disabled) return;
    void refresh();
  }, [autoLoad, disabled, refresh]);

  const jsonText = useMemo(() => {
    if (!dteJson) return '';
    try {
      return JSON.stringify(dteJson, null, 2);
    } catch {
      return String(dteJson);
    }
  }, [dteJson]);

  return (
    <div
      className={[
        'rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-medium text-foreground">
            <FileJson className="size-4 text-primary" />
            {title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || loading}
          onClick={() => void refresh()}
          className="shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <RefreshCw className="size-4" />
              {loaded ? 'Actualizar preview' : 'Ver JSON Hacienda'}
            </>
          )}
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
          {error}
        </p>
      ) : null}

      {meta && loaded ? (
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <p className="text-muted-foreground">Tipo DTE</p>
            <p className="font-mono font-semibold text-foreground">{meta.tipoDte || '—'}</p>
          </div>
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <p className="text-muted-foreground">Codigo generacion</p>
            <p className="font-mono text-[11px] font-semibold text-foreground">
              {meta.codigoGeneracion || '—'}
            </p>
          </div>
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <p className="text-muted-foreground">Numero control (preview)</p>
            <p className="font-mono text-[11px] font-semibold text-foreground">
              {meta.numeroControl || '—'}
            </p>
          </div>
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <p className="text-muted-foreground">Total a pagar</p>
            <p className="font-semibold text-foreground">{formatMoney(meta.totalPagar)}</p>
          </div>
        </div>
      ) : null}

      {jsonText ? (
        <pre
          className="mt-3 max-h-[min(70vh,640px)] overflow-auto rounded-md border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground"
        >
          {jsonText}
        </pre>
      ) : loaded && !error ? (
        <p className="mt-3 text-xs text-muted-foreground">No se recibio JSON del documento.</p>
      ) : null}
    </div>
  );
}
