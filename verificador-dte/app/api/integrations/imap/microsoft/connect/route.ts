import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

import { resolveRequestOrigin } from '@/lib/app-origin';
import { signOAuthState } from '@/lib/gmail/oauth';
import {
  buildMicrosoftConsentUrl,
  resolveMicrosoftOAuthRedirectUri,
} from '@/lib/imap/microsoft-oauth';
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
    let expectedEmail: string | undefined;
    try {
      const body = (await req.json()) as { returnOrigin?: string; email?: string };
      if (body.returnOrigin?.trim()) {
        returnOrigin = resolveRequestOrigin({
          nextUrl: req.nextUrl,
          headers: new Headers({ origin: body.returnOrigin.trim() }),
        });
      }
      expectedEmail = body.email?.trim().toLowerCase() || undefined;
    } catch {
      // body opcional
    }

    const redirectUri = resolveMicrosoftOAuthRedirectUri(returnOrigin);

    const state = signOAuthState({
      organizationId: user.organizationId,
      uid: user.uid,
      nonce: randomUUID(),
      expectedEmail,
      returnOrigin,
      redirectUri,
    });

    return NextResponse.json({ url: buildMicrosoftConsentUrl(state, redirectUri) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
