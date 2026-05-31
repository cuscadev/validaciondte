const GO_DTE_API_LOCAL = 'http://127.0.0.1:8081';
const GO_DTE_API_RENDER = 'https://validaciondte.onrender.com';

export const DEFAULT_CONCURRENCY = Number(process.env.GO_DTE_DEFAULT_CONCURRENCY ?? 8);

/** URL base del microservicio Go (sin barra final). */
export function getGoDteApiUrl(): string {
  const explicit = process.env.GO_DTE_API_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    return GO_DTE_API_RENDER;
  }

  return GO_DTE_API_LOCAL;
}

export type GoDteProcessResponse = {
  jobId?: string;
  status?: string;
  done?: number;
  filename?: string;
  total?: number;
  resultados: Record<string, unknown>[];
  excelBase64?: string;
  downloadUrl?: string;
};

export type GoDteBatchJobStatus = {
  jobId: string;
  status: string;
  total: number;
  done: number;
  resultados?: Record<string, unknown>[];
  filename?: string;
  excelBase64?: string;
  error?: string;
  updatedAt?: string;
};

export type CodFechaItem = {
  codGen: string;
  fechaYmd: string;
};

export type ProcessDteOptions = {
  ambiente?: string;
  concurrencia?: number;
  includeExcel?: boolean;
  enrichCreditNotes?: boolean;
  async?: boolean;
};

export async function fetchDteJob(jobId: string): Promise<GoDteBatchJobStatus> {
  const res = await fetch(`${getGoDteApiUrl()}/api/dte/jobs/${encodeURIComponent(jobId)}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Job fetch error ${res.status}`);
  }
  return res.json();
}

export async function pollDteJob(
  jobId: string,
  onProgress?: (status: GoDteBatchJobStatus) => void,
  intervalMs = 1000,
): Promise<GoDteBatchJobStatus> {
  for (;;) {
    const status = await fetchDteJob(jobId);
    onProgress?.(status);
    if (status.status === 'done' || status.status === 'error') {
      if (status.status === 'error') {
        throw new Error(status.error || 'Error procesando lote');
      }
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function processDteViaGo(
  items: Array<{ codGen: string; fecha?: string; fechaYmd?: string }>,
  options?: ProcessDteOptions,
): Promise<GoDteProcessResponse> {
  const res = await fetch(`${getGoDteApiUrl()}/api/procesaedte`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items,
      ambiente: options?.ambiente ?? '01',
      concurrencia: options?.concurrencia ?? DEFAULT_CONCURRENCY,
      includeExcel: options?.includeExcel ?? false,
      enrichCreditNotes: options?.enrichCreditNotes ?? false,
      async: options?.async ?? false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Go API error ${res.status}`);
  }

  const payload = (await res.json()) as GoDteProcessResponse;
  if (payload.jobId && payload.status === 'pending') {
    const finalJob = await pollDteJob(payload.jobId);
    return {
      jobId: finalJob.jobId,
      status: finalJob.status,
      total: finalJob.total,
      done: finalJob.done,
      resultados: finalJob.resultados ?? [],
      filename: finalJob.filename,
      excelBase64: finalJob.excelBase64,
    };
  }

  return payload;
}

export async function consultCodFechaViaGo(
  items: CodFechaItem[],
  options?: ProcessDteOptions,
): Promise<GoDteProcessResponse> {
  return processDteViaGo(
    items.map((item) => ({ codGen: item.codGen, fechaYmd: item.fechaYmd })),
    {
      ambiente: options?.ambiente,
      concurrencia: options?.concurrencia,
      includeExcel: options?.includeExcel,
      enrichCreditNotes: options?.enrichCreditNotes,
      async: options?.async,
    },
  );
}

export async function proxyMultipartToGo(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<Response> {
  return fetch(`${getGoDteApiUrl()}${path}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });
}
