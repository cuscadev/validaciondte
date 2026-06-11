import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

import { resolveGmailOAuthRedirectUri, resolveRequestOrigin } from '@/lib/app-origin';
import { buildConsentUrl, signOAuthState } from '@/lib/gmail/oauth';
import { requireOrgAdmin } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() || undefined;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireOrgAdmin(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion asignada.' }, { status: 400 });
    }

    let returnOrigin = resolveRequestOrigin(req);
    let expectedEmail: string | undefined;
    try {
      const body = (await req.json()) as { returnOrigin?: string; email?: string };
      if (body.returnOrigin?.trim()) {
        returnOrigin = resolveRequestOrigin({
          nextUrl: req.nextUrl,
          headers: new Headers({ origin: body.returnOrigin.trim() }),
        });
      }
      expectedEmail = normalizeEmail(body.email);
    } catch {
      // body optional
    }

    const redirectUri = resolveGmailOAuthRedirectUri(returnOrigin);

    const state = signOAuthState({
      organizationId: user.organizationId,
      uid: user.uid,
      nonce: randomUUID(),
      expectedEmail,
      returnOrigin,
      redirectUri,
    });

    return NextResponse.json({ url: buildConsentUrl(state, redirectUri) });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Error';
    const message =
      rawMessage.includes('GOOGLE_CLIENT_ID') || rawMessage.includes('GOOGLE_CLIENT_SECRET')
        ? 'Google OAuth no esta configurado. Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel.'
        : rawMessage;
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireOrgAdmin(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion asignada.' }, { status: 400 });
    }

    const returnOrigin = resolveRequestOrigin(req);
    const redirectUri = resolveGmailOAuthRedirectUri(returnOrigin);
    const expectedEmail = normalizeEmail(req.nextUrl.searchParams.get('email') || undefined);

    const state = signOAuthState({
      organizationId: user.organizationId,
      uid: user.uid,
      nonce: randomUUID(),
      expectedEmail,
      returnOrigin,
      redirectUri,
    });

    return NextResponse.redirect(buildConsentUrl(state, redirectUri));
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Error';
    const message =
      rawMessage.includes('GOOGLE_CLIENT_ID') || rawMessage.includes('GOOGLE_CLIENT_SECRET')
        ? 'Google OAuth no esta configurado. Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel.'
        : rawMessage;
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
