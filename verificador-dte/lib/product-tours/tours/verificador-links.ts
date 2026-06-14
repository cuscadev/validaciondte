/** Reexportes de compatibilidad. Definiciones en verificador-tours.ts y upload-verifier-tour.ts */
export { VERIFICADOR_LINKS_TOUR_ID, VERIFICADOR_TOURS } from '@/lib/product-tours/tours/verificador-tours';
export {
  UPLOAD_VERIFIER_RESULTS_READY_EVENT as VERIFICADOR_LINKS_RESULTS_READY_EVENT,
  uploadVerifierResultsSteps as verificadorLinksTourResultsSteps,
  reactivationHintStep,
} from '@/lib/product-tours/tours/upload-verifier-tour';

import { VERIFICADOR_TOURS } from '@/lib/product-tours/tours/verificador-tours';

export const verificadorLinksTourSteps =
  VERIFICADOR_TOURS.find((t) => t.id === 'verificador-links')?.steps ?? [];
