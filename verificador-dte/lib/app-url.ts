import type { NextRequest } from 'next/server';

/**
 * Base URL for links in emails and redirects.
 * Prefer NEXT_PUBLIC_APP_URL / APP_URL; fall back to the incoming request host.
 */
export function getAppBaseUrl(req?: Pick<NextRequest, 'headers' | 'nextUrl'>) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured?.trim()) {
    return configured.trim().replace(/\/$/, '');
  }

  if (req) {
    const host =
      req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
      req.headers.get('host')?.trim();
    const proto =
      req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
      (host?.includes('localhost') ? 'http' : 'https');
    if (host) {
      return `${proto}://${host}`.replace(/\/$/, '');
    }
    if (req.nextUrl?.origin) {
      return req.nextUrl.origin.replace(/\/$/, '');
    }
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
  }

  return 'http://localhost:3000';
}

export function buildCollaboratorInviteUrl(token: string, req?: Pick<NextRequest, 'headers' | 'nextUrl'>) {
  return `${getAppBaseUrl(req)}/invitacion-colaborador?token=${encodeURIComponent(token)}`;
}

export function isCollaboratorInviteToken(value: string | null | undefined) {
  return Boolean(value && /^[a-f0-9]{32,128}$/i.test(value));
}
