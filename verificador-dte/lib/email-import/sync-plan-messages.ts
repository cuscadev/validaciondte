import type { SyncPlanResult } from '@/lib/email-import/sync-plan';

type ToastApi = {
  success: (message: string) => void;
  info: (message: string) => void;
};

export function notifySyncCompleted(
  syncPlan: SyncPlanResult | undefined,
  job: { imported_count: number; skipped_count: number },
  toast: ToastApi
) {
  if (syncPlan?.action === 'cache_hit') {
    const count = syncPlan.documentCount ?? 0;
    toast.success(
      `Este rango ya estaba importado. Mostrando ${count} documento${count === 1 ? '' : 's'} del catalogo.`
    );
    return;
  }

  if (syncPlan?.action === 'partial') {
    toast.info(syncPlan.message);
  }

  toast.success(
    `Sync finalizado: ${job.imported_count} importados, ${job.skipped_count} omitidos.`
  );
}

export const SYNC_CATALOG_HELP =
  'Ver documentos no requiere importar; el catalogo se lee de la base de datos. Si el rango ya fue importado, no se vuelve a abrir el correo.';
