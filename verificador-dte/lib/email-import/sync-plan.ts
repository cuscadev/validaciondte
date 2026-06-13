import type { GmailSyncJobRow } from '@/lib/gmail/types';

export type SyncPlanAction = 'cache_hit' | 'partial' | 'full';

export type DateRange = {
  from: string;
  to: string;
};

export type SyncPlanResult = {
  action: SyncPlanAction;
  requestedFrom: string;
  requestedTo: string;
  effectiveFrom: string;
  effectiveTo: string;
  skippedFrom?: string;
  skippedTo?: string;
  message: string;
  documentCount?: number;
};

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mergeCompletedRanges(
  jobs: Array<Pick<GmailSyncJobRow, 'date_from' | 'date_to'>>
): DateRange[] {
  const sorted = jobs
    .filter((job) => job.date_from && job.date_to)
    .sort((a, b) => a.date_from.localeCompare(b.date_from));

  const merged: DateRange[] = [];
  for (const job of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ from: job.date_from, to: job.date_to });
      continue;
    }
    if (addDays(last.to, 1) >= job.date_from) {
      if (job.date_to > last.to) last.to = job.date_to;
    } else {
      merged.push({ from: job.date_from, to: job.date_to });
    }
  }
  return merged;
}

function fullPlan(dateFrom: string, dateTo: string, message: string): SyncPlanResult {
  return {
    action: 'full',
    requestedFrom: dateFrom,
    requestedTo: dateTo,
    effectiveFrom: dateFrom,
    effectiveTo: dateTo,
    message,
  };
}

export function resolveSyncPlan(input: {
  dateFrom: string;
  dateTo: string;
  completedJobs: Array<Pick<GmailSyncJobRow, 'date_from' | 'date_to'>>;
}): SyncPlanResult {
  const { dateFrom, dateTo } = input;
  const merged = mergeCompletedRanges(input.completedJobs);

  if (merged.length === 0) {
    return fullPlan(dateFrom, dateTo, 'Sin historial de importacion previa.');
  }

  const relevant = merged
    .filter((range) => range.to >= dateFrom && range.from <= dateTo)
    .sort((a, b) => a.from.localeCompare(b.from));

  if (relevant.length === 0) {
    return fullPlan(dateFrom, dateTo, 'El rango solicitado no tiene cobertura previa.');
  }

  let cursor = dateFrom;
  for (const range of relevant) {
    if (range.from > cursor) {
      return fullPlan(
        dateFrom,
        dateTo,
        'Hay fechas sin importar en el rango solicitado.'
      );
    }
    if (range.to >= cursor) {
      cursor = addDays(range.to, 1);
    }
  }

  if (cursor > dateTo) {
    return {
      action: 'cache_hit',
      requestedFrom: dateFrom,
      requestedTo: dateTo,
      effectiveFrom: dateFrom,
      effectiveTo: dateTo,
      skippedFrom: dateFrom,
      skippedTo: dateTo,
      message: `El rango ${dateFrom} — ${dateTo} ya fue importado.`,
    };
  }

  const endCovered = addDays(cursor, -1);
  return {
    action: 'partial',
    requestedFrom: dateFrom,
    requestedTo: dateTo,
    effectiveFrom: cursor,
    effectiveTo: dateTo,
    skippedFrom: dateFrom,
    skippedTo: endCovered,
    message: `${dateFrom} — ${endCovered} ya importado. Buscando desde ${cursor}.`,
  };
}
