export type DteProcessingStats = {
  processed: number;
  conAjuste: number;
  sinAjuste: number;
  errores: number;
};

type DteResultLike = {
  error?: string;
  Error?: string;
  estado?: string;
  Estado?: string;
  status?: string;
  documentoAjustado?: string;
  ajustado?: boolean;
};

function isErrored(result: DteResultLike) {
  if (result.error || result.Error) return true;
  if (result.status === 'error') return true;
  const estado = String(result.estado || result.Estado || '').toUpperCase();
  return estado === 'ERROR';
}

function hasAjuste(result: DteResultLike) {
  if (result.ajustado === true) return true;
  return /ajustad/i.test(result.documentoAjustado || '');
}

export function summarizeDteUploadResults(results: DteResultLike[]): DteProcessingStats {
  let conAjuste = 0;
  let sinAjuste = 0;
  let errores = 0;

  for (const result of results) {
    if (isErrored(result)) {
      errores += 1;
      continue;
    }

    if (hasAjuste(result)) {
      conAjuste += 1;
    } else {
      sinAjuste += 1;
    }
  }

  return {
    processed: results.length,
    conAjuste,
    sinAjuste,
    errores,
  };
}

export function formatCompactSummary(stats: DteProcessingStats) {
  const parts = [`${stats.processed} proc`];

  if (stats.conAjuste > 0) {
    parts.push(`${stats.conAjuste} ajuste`);
  }

  if (stats.sinAjuste > 0) {
    parts.push(`${stats.sinAjuste} ok`);
  }

  if (stats.errores > 0) {
    parts.push(`${stats.errores} err`);
  }

  return parts.join(' · ');
}

export function formatCompactSummaryAria(stats: DteProcessingStats) {
  return `${stats.processed} procesados, ${stats.conAjuste} con ajuste, ${stats.sinAjuste} sin ajuste, ${stats.errores} erróneos`;
}
