import { driver, type Config, type DriveStep } from 'driver.js';

import { reactivationHintStep } from '@/lib/product-tours/tours/upload-verifier-tour';

type RunTourOptions = {
  steps: DriveStep[];
  onFinished?: (result: 'completed' | 'dismissed') => void;
  onDismissed?: () => void;
  /** Si se define, al pulsar el boton final de la ultima fase se pausa la guia en lugar de marcarla como completada. */
  onDeferRemaining?: () => void;
};

export type ProductTourHandle = {
  destroy: (options?: { silent?: boolean }) => void;
};

function baseConfig(): Partial<Config> {
  return {
    animate: true,
    allowClose: true,
    overlayClickBehavior: 'close',
    showProgress: true,
    progressText: 'Paso {{current}} de {{total}}',
    nextBtnText: 'Siguiente',
    prevBtnText: 'Atrás',
    doneBtnText: 'Entendido',
    popoverClass: 'kaydte-driver-popover',
  };
}

export function runProductTour({
  steps,
  onFinished,
  onDismissed,
  onDeferRemaining,
}: RunTourOptions): ProductTourHandle {
  let completed = false;
  let silentDestroy = false;

  const driverObj = driver({
    ...baseConfig(),
    steps,
    onNextClick: (_element, _step, { driver: activeDriver }) => {
      if (activeDriver.isLastStep()) {
        if (onDeferRemaining) {
          silentDestroy = true;
          onDeferRemaining();
          driverObj.destroy();
          return;
        }
        completed = true;
      }
      activeDriver.moveNext();
    },
    onCloseClick: () => {
      driverObj.destroy();
    },
    onDestroyed: () => {
      if (silentDestroy) return;

      if (completed) {
        onFinished?.('completed');
        return;
      }

      onFinished?.('dismissed');
      onDismissed?.();
    },
  });

  driverObj.drive();

  return {
    destroy: (options) => {
      silentDestroy = options?.silent ?? false;
      driverObj.destroy();
    },
  };
}

export function runReactivationHint(onClose?: () => void): ProductTourHandle {
  let silentDestroy = false;

  const driverObj = driver({
    ...baseConfig(),
    showProgress: false,
    steps: [reactivationHintStep],
    onDestroyed: () => {
      if (!silentDestroy) {
        onClose?.();
      }
    },
  });

  driverObj.drive();

  return {
    destroy: (options) => {
      silentDestroy = options?.silent ?? false;
      driverObj.destroy();
    },
  };
}
