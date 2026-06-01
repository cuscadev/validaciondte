import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

import { resolveGmailOAuthRedirectUri, resolveRequestOrigin } from '@/lib/app-origin';
import { buildConsentUrl, signOAuthState } from '@/lib/gmail/oauth';
import { requireOrgAdmin } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireOrgAdmin(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion asignada.' }, { status: 400 });
    }

    let returnOrigin = resolveRequestOrigin(req);
    try {
      const body = (await req.json()) as { returnOrigin?: string };
      if (body.returnOrigin?.trim()) {
        returnOrigin = resolveRequestOrigin({
          nextUrl: req.nextUrl,
          headers: new Headers({ origin: body.returnOrigin.trim() }),
        });
      }
    } catch {
      // body optional
    }

    const redirectUri = resolveGmailOAuthRedirectUri(returnOrigin);

    const state = signOAuthState({
      organizationId: user.organizationId,
      uid: user.uid,
      nonce: randomUUID(),
      returnOrigin,
      redirectUri,
    });

    return NextResponse.json({ url: buildConsentUrl(state, redirectUri) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
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

    const state = signOAuthState({
      organizationId: user.organizationId,
      uid: user.uid,
      nonce: randomUUID(),
      returnOrigin,
      redirectUri,
    });

    return NextResponse.redirect(buildConsentUrl(state, redirectUri));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
