export type ProcessingOutcome = 'success' | 'partial' | 'error';

export type ProcessingFileSummary = {
  count: number;
  totalBytes: number;
  extensions: string[];
  mimeTypes: string[];
};

export type ProcessingLogPayload = {
  routeKey: string;
  moduleName: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  files: ProcessingFileSummary;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  statusBreakdown: Record<string, number>;
  outcome: ProcessingOutcome;
  errorMessage?: string;
};

export function summarizeFiles(files: File[]): ProcessingFileSummary {
  const extensions = new Set<string>();
  const mimeTypes = new Set<string>();
  let totalBytes = 0;

  for (const file of files) {
    totalBytes += file.size || 0;
    const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
    if (ext) extensions.add(ext);
    if (file.type) mimeTypes.add(file.type);
  }

  return {
    count: files.length,
    totalBytes,
    extensions: Array.from(extensions).sort(),
    mimeTypes: Array.from(mimeTypes).sort(),
  };
}

export function summarizeResults(results: Array<{ estado?: string; error?: string }>) {
  const statusBreakdown: Record<string, number> = {};
  let successCount = 0;
  let errorCount = 0;

  for (const result of results) {
    const status = String(result.estado || (result.error ? 'ERROR' : 'SIN_ESTADO')).toUpperCase();
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

    if (result.error || status === 'ERROR') {
      errorCount += 1;
    } else {
      successCount += 1;
    }
  }

  const outcome: ProcessingOutcome =
    errorCount === 0 ? 'success' : successCount === 0 ? 'error' : 'partial';

  return {
    totalRecords: results.length,
    successCount,
    errorCount,
    statusBreakdown,
    outcome,
  };
}
