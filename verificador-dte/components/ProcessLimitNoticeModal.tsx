'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import type { LimitNoticeStatus } from '@/lib/usage-limits';

type ProcessLimitNoticeModalProps = {
  open: boolean;
  status: LimitNoticeStatus | null;
  saving: boolean;
  error?: string | null;
  onAccept: () => void | Promise<void>;
};

function formatLimit(value: number | null): string {
  if (value === null) return 'Ilimitado';
  return value.toLocaleString('es-SV');
}

export default function ProcessLimitNoticeModal({
  open,
  status,
  saving,
  error,
  onAccept,
}: ProcessLimitNoticeModalProps) {
  if (!status || status.batchLimit === null) return null;

  return (
    <Modal open={open} onClose={() => {}} disableClose className="w-[min(96vw,34rem)]">
      <div className="space-y-4 pr-6">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Aviso de limite por proceso</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Antes de usar <span className="font-medium text-foreground">{status.routeLabel}</span>,
              confirma que fuiste informado sobre el limite por proceso asignado a tu cuenta u
              organizacion.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-brand-orange/30 bg-brand-orange/10 p-4 text-sm">
            <p className="font-semibold text-foreground">Limite por proceso</p>
            <p className="mt-1 text-muted-foreground">
              Maximo por cada ejecucion:{' '}
              <span className="font-bold text-foreground">
                {formatLimit(status.batchLimit)} {status.batchUnit}
              </span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Aplica cada vez que subes o procesas un lote. No es lo mismo que el limite mensual:
              este controla cuantos {status.batchUnit} puedes enviar en una sola operacion.
            </p>
          </div>

          {status.monthlyLimit !== null ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <p className="font-semibold">Limite mensual (aparte)</p>
              <p className="mt-1">
                Total del ciclo:{' '}
                <span className="font-bold">
                  {formatLimit(status.monthlyLimit)} {status.monthlyUnit}
                </span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Es independiente del limite por proceso. Suma todas tus ejecuciones del mes o ciclo
                de facturacion; puedes hacer varias operaciones siempre que ninguna supere el maximo
                por proceso.
              </p>
            </div>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Si un administrador cambia el limite por proceso, este aviso volvera a mostrarse para que
          confirmes la nueva configuracion.
        </p>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          className="w-full bg-primary font-bold text-black hover:bg-primary/90"
          disabled={saving}
          onClick={() => void onAccept()}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Guardando...
            </>
          ) : (
            'Entendido, acepto'
          )}
        </Button>
      </div>
    </Modal>
  );
}
