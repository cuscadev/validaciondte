import { NextRequest, NextResponse } from 'next/server';

import { resolveReturnOrigin } from '@/lib/app-origin';
import { fetchGoogleEmailFromOAuth } from '@/lib/gmail/client';
import { mapGmailCallbackError } from '@/lib/gmail/callback-errors';
import { getActiveConnection, updateConnectionAfterOAuth, upsertConnection } from '@/lib/gmail/db';
import {
  createOAuth2Client,
  exchangeCodeForTokens,
  verifyOAuthState,
} from '@/lib/gmail/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UI_PATH = '/integraciones/gmail';

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
      // state invalid; handled below
    }
  }

  if (oauthError) {
    return uiRedirect(req, returnOrigin, `?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code || !state) {
    return uiRedirect(req, returnOrigin, '?error=missing_params');
  }

  try {
    const payload = verifyOAuthState(state);
    returnOrigin = payload.returnOrigin;
    const redirectUri = payload.redirectUri;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    const oauth2 = createOAuth2Client(redirectUri);
    oauth2.setCredentials(tokens);
    const googleEmail = await fetchGoogleEmailFromOAuth(oauth2);
    if (
      payload.expectedEmail &&
      googleEmail.trim().toLowerCase() !== payload.expectedEmail.trim().toLowerCase()
    ) {
      return uiRedirect(req, returnOrigin, '?error=email_mismatch');
    }

    if (!tokens.refresh_token) {
      const existing = await getActiveConnection(payload.organizationId);
      if (!existing) {
        return uiRedirect(req, returnOrigin, '?error=no_refresh_token');
      }
      await updateConnectionAfterOAuth({
        organizationId: payload.organizationId,
        googleEmail,
        accessToken: tokens.access_token,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        connectedByUid: payload.uid,
      });
    } else {
      await upsertConnection({
        organizationId: payload.organizationId,
        googleEmail,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        connectedByUid: payload.uid,
      });
    }

    return uiRedirect(req, returnOrigin, '?connected=1');
  } catch (error) {
    const code = mapGmailCallbackError(error);
    console.error('[gmail/callback]', code, error);
    return uiRedirect(req, returnOrigin, `?error=${encodeURIComponent(code)}`);
  }
}
