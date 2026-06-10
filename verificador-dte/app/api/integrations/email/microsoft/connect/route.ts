import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import {
  buildMicrosoftConsentUrl,
  signMicrosoftOAuthState,
} from '@/lib/email/microsoft-oauth';
import { requireOrgAdmin } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireOrgAdmin(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion.' }, { status: 400 });
    }

    const origin =
      req.headers.get('origin')?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      'http://localhost:3000';

    const redirectUri =
      process.env.MICROSOFT_OAUTH_REDIRECT_URI?.trim() ||
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/email/microsoft/callback`;

    const state = signMicrosoftOAuthState({
      organizationId: user.organizationId,
      uid: user.uid,
      nonce: randomBytes(16).toString('hex'),
      returnOrigin: origin,
      redirectUri,
    });

    const url = buildMicrosoftConsentUrl(state, redirectUri);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
