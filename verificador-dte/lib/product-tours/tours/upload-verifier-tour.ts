import type { DriveStep } from 'driver.js';

export const UPLOAD_VERIFIER_RESULTS_READY_EVENT = 'product-tour:upload-verifier-results-ready';

export const UPLOAD_VERIFIER_SELECTORS = {
  upload: '[data-tour="verificador-upload"]',
  template: '[data-tour="verificador-template"]',
  submit: '[data-tour="verificador-submit"]',
  input: '[data-tour="verificador-input"]',
  qrCamera: '[data-tour="verificador-qr-camera"]',
  qrPending: '[data-tour="verificador-qr-pending"]',
  export: '[data-tour="verificador-export"]',
  filters: '[data-tour="verificador-filters"]',
  resultsTable: '[data-tour="verificador-results-table"]',
} as const;

type StepCopy = {
  title: string;
  description: string;
  doneBtnText?: string;
  nextBtnText?: string;
};

type ElementStep = StepCopy & {
  element: string;
};

function introStep(copy: StepCopy): DriveStep {
  return {
    popover: {
      title: copy.title,
      description: copy.description,
      side: 'over',
      align: 'center',
    },
  };
}

function elementStep(copy: ElementStep): DriveStep {
  return {
    element: copy.element,
    popover: {
      title: copy.title,
      description: copy.description,
      side: copy.element.includes('submit') || copy.element.includes('results-table') ? 'top' : 'bottom',
      align: 'start',
      ...(copy.doneBtnText ? { doneBtnText: copy.doneBtnText } : {}),
      ...(copy.nextBtnText ? { nextBtnText: copy.nextBtnText } : {}),
    },
  };
}

export const uploadVerifierResultsSteps: DriveStep[] = [
  {
    element: UPLOAD_VERIFIER_SELECTORS.export,
    popover: {
      title: '¡Listo! Ahora descarga tus resultados',
      description:
        'Pulsa Exportar a y elige cómo lo quieres: Excel si trabajas en hojas de cálculo, CSV para compartir datos, o PDF si necesitas un reporte para imprimir.',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    element: UPLOAD_VERIFIER_SELECTORS.filters,
    popover: {
      title: 'Encuentra lo que buscas',
      description:
        '¿Muchos resultados? Usa Filtrar para buscar por código, estado o número de control. También puedes elegir cuántas filas ver a la vez.',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    element: UPLOAD_VERIFIER_SELECTORS.resultsTable,
    popover: {
      title: 'Revisa cada documento',
      description:
        'Aquí ves el estado de cada DTE, los montos y las observaciones. Si quieres comprobarlo en Hacienda, usa el botón Visitar en la tabla.',
      side: 'top',
      align: 'start',
    },
  },
];

export const reactivationHintStep: DriveStep = {
  element: '[data-tour="user-menu-trigger"]',
  popover: {
    title: '¿Quieres ver la guía otra vez?',
    description:
      'Haz clic en tu foto (arriba a la derecha) y elige Ver guía de ayuda. La guía estará disponible cuando la necesites.',
    side: 'bottom',
    align: 'end',
  },
};

export function notifyUploadVerifierTourResultsReady(tourId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(UPLOAD_VERIFIER_RESULTS_READY_EVENT, { detail: { tourId } }),
  );
}

export function buildUploadFormVerifierTour(config: {
  intro: StepCopy;
  upload: StepCopy;
  template?: StepCopy;
  submit: StepCopy;
}): DriveStep[] {
  const steps: DriveStep[] = [
    introStep(config.intro),
    elementStep({ ...config.upload, element: UPLOAD_VERIFIER_SELECTORS.upload }),
  ];

  if (config.template) {
    steps.push(elementStep({ ...config.template, element: UPLOAD_VERIFIER_SELECTORS.template }));
  }

  steps.push({
    ...elementStep({ ...config.submit, element: UPLOAD_VERIFIER_SELECTORS.submit }),
    popover: {
      title: config.submit.title,
      description: config.submit.description,
      side: 'top',
      align: 'start',
      doneBtnText: config.submit.doneBtnText ?? '¡Vamos!',
    },
  });

  return steps;
}

export function buildCustomVerifierTour(steps: DriveStep[]): DriveStep[] {
  return steps;
}
