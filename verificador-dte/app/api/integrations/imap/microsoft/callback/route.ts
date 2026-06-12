import { NextRequest, NextResponse } from 'next/server';

import { resolveReturnOrigin } from '@/lib/app-origin';
import { verifyOAuthState } from '@/lib/gmail/oauth';
import { testImapConnection } from '@/lib/imap/client';
import { upsertImapOAuthConnection } from '@/lib/imap/firebase-db';
import { exchangeMicrosoftCode } from '@/lib/imap/microsoft-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UI_PATH = '/integraciones/correo-imap';

function uiRedirect(req: NextRequest, returnOrigin: string | undefined, query: string) {
  const base = resolveReturnOrigin(returnOrigin, req.nextUrl.origin);
  return NextResponse.redirect(`${base}${UI_PATH}${query}`);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error');

  let returnOrigin: string | undefined;
  if (state) {
    try {
      returnOrigin = verifyOAuthState(state).returnOrigin;
    } catch {
      // state invalido; se maneja abajo
    }
  }

  if (oauthError) {
    const description = req.nextUrl.searchParams.get('error_description') || oauthError;
    return uiRedirect(req, returnOrigin, `?error=${encodeURIComponent(description)}`);
  }

  if (!code || !state) {
    return uiRedirect(req, returnOrigin, '?error=missing_params');
  }

  try {
    const payload = verifyOAuthState(state);
    returnOrigin = payload.returnOrigin;

    const tokens = await exchangeMicrosoftCode(code, payload.redirectUri || '');

    if (!tokens.email) {
      return uiRedirect(req, returnOrigin, '?error=no_email');
    }
    if (
      payload.expectedEmail &&
      tokens.email !== payload.expectedEmail.trim().toLowerCase()
    ) {
      return uiRedirect(req, returnOrigin, '?error=email_mismatch');
    }
    if (!tokens.refreshToken) {
      return uiRedirect(req, returnOrigin, '?error=no_refresh_token');
    }

    // Verifica que el tenant realmente permita IMAP antes de guardar.
    await testImapConnection({
      host: 'outlook.office365.com',
      port: 993,
      secure: true,
      email: tokens.email,
      accessToken: tokens.accessToken,
    });

    await upsertImapOAuthConnection({
      organizationId: payload.organizationId,
      email: tokens.email,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      tokenExpiresAt: tokens.expiresAt,
      connectedByUid: payload.uid,
    });

    return uiRedirect(req, returnOrigin, '?connected=1');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'callback_error';
    console.error('[imap/microsoft/callback]', error);
    return uiRedirect(req, returnOrigin, `?error=${encodeURIComponent(message)}`);
  }
}
