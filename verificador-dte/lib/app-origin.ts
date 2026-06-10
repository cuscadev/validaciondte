/** Origen permitido para volver tras OAuth (evita open redirect). */
export function isAllowedAppOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

    const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
    if (configured) {
      const cfg = new URL(configured);
      if (url.origin === cfg.origin) return true;
    }

    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;

    const vercelHost = process.env.VERCEL_URL?.trim();
    if (vercelHost && url.host === vercelHost) return true;

    return false;
  } catch {
    return false;
  }
}

export function resolveReturnOrigin(
  candidate: string | null | undefined,
  fallbackOrigin: string
): string {
  const trimmed = candidate?.trim();
  if (trimmed && isAllowedAppOrigin(trimmed)) {
    return trimmed.replace(/\/$/, '');
  }
  return fallbackOrigin.replace(/\/$/, '');
}

export function resolveRequestOrigin(req: { nextUrl: URL; headers: Headers }): string {
  const originHeader = req.headers.get('origin')?.trim();
  if (originHeader && isAllowedAppOrigin(originHeader)) {
    return originHeader.replace(/\/$/, '');
  }

  const referer = req.headers.get('referer')?.trim();
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (isAllowedAppOrigin(refererOrigin)) return refererOrigin;
    } catch {
      // ignore invalid referer
    }
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  return req.nextUrl.origin;
}
