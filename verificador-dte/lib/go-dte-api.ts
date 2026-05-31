const GO_DTE_API_LOCAL = 'http://127.0.0.1:8081';
const GO_DTE_API_RENDER = 'https://validaciondte.onrender.com';

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
  filename?: string;
  total?: number;
  resultados: Record<string, unknown>[];
  excelBase64?: string;
  downloadUrl?: string;
};

export type CodFechaItem = {
  codGen: string;
  fechaYmd: string;
};

export async function consultCodFechaViaGo(
  items: CodFechaItem[],
  options?: { ambiente?: string; concurrencia?: number },
): Promise<GoDteProcessResponse> {
  const res = await fetch(`${getGoDteApiUrl()}/api/procesaedte`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: items.map((item) => ({
        codGen: item.codGen,
        fechaYmd: item.fechaYmd,
      })),
      ambiente: options?.ambiente ?? '01',
      concurrencia: options?.concurrencia ?? 2,
      includeExcel: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Go API error ${res.status}`);
  }

  return res.json();
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
