import { NextRequest, NextResponse } from 'next/server';

import { insertConnection } from '@/lib/email/db';
import { testImapOAuthConnection } from '@/lib/email/imap-client';
import {
  assertAccountEmailForImap,
  getProviderPreset,
  normalizeEmailAddress,
} from '@/lib/email/provider-presets';
import {
  exchangeMicrosoftCodeForTokens,
  extractEmailFromIdToken,
  formatMicrosoftOAuthError,
  verifyMicrosoftOAuthState,
} from '@/lib/email/microsoft-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectWithError(returnOrigin: string, message: string): NextResponse {
  const url = new URL('/integraciones/correo', returnOrigin);
  url.searchParams.set('error', message.slice(0, 500));
  return NextResponse.redirect(url);
}

function redirectWithSuccess(returnOrigin: string): NextResponse {
  const url = new URL('/integraciones/correo', returnOrigin);
  url.searchParams.set('connected', 'microsoft');
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const defaultOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';

  const code = req.nextUrl.searchParams.get('code')?.trim() || '';
  const stateToken = req.nextUrl.searchParams.get('state')?.trim() || '';
  const oauthError = req.nextUrl.searchParams.get('error_description') ||
    req.nextUrl.searchParams.get('error') ||
    '';

  let returnOrigin = defaultOrigin;

  try {
    if (oauthError) {
      return redirectWithError(returnOrigin, formatMicrosoftOAuthError(oauthError));
    }

    if (!code || !stateToken) {
      return redirectWithError(returnOrigin, 'Faltan parametros de autorizacion de Microsoft.');
    }

    const state = verifyMicrosoftOAuthState(stateToken);
    returnOrigin = state.returnOrigin?.trim() || defaultOrigin;

    const tokens = await exchangeMicrosoftCodeForTokens(code, state.redirectUri);
    if (!tokens.refresh_token) {
      return redirectWithError(
        returnOrigin,
        'Microsoft no devolvio refresh_token. Cierra sesion en Microsoft e intenta de nuevo con consentimiento completo.'
      );
    }

    const oauthEmail =
      (tokens.id_token ? extractEmailFromIdToken(tokens.id_token) : null) || null;

    if (!oauthEmail) {
      return redirectWithError(
        returnOrigin,
        'No se pudo determinar el correo de la cuenta Microsoft autorizada.'
      );
    }

    const { adminAuth } = await import('@/lib/firebase-admin');
    const firebaseUser = await adminAuth.getUser(state.uid);
    const accountEmail = normalizeEmailAddress(firebaseUser.email || '');

    try {
      assertAccountEmailForImap({ submittedEmail: oauthEmail, accountEmail });
    } catch (validationError) {
      return redirectWithError(
        returnOrigin,
        validationError instanceof Error
          ? validationError.message
          : 'El correo de Microsoft no coincide con tu sesion.'
      );
    }

    const preset = getProviderPreset('microsoft');

    try {
      await testImapOAuthConnection({
        emailAddress: oauthEmail,
        accessToken: tokens.access_token,
        imapHost: preset.imapHost,
        imapPort: preset.imapPort,
        imapSecure: preset.imapSecure,
      });
    } catch {
      return redirectWithError(
        returnOrigin,
        'IMAP rechazo el token OAuth. Verifica que IMAP este habilitado en tu cuenta Outlook.'
      );
    }

    await insertConnection({
      organizationId: state.organizationId,
      provider: 'microsoft',
      emailAddress: oauthEmail,
      imapHost: preset.imapHost,
      imapPort: preset.imapPort,
      imapSecure: preset.imapSecure,
      mailboxFolder: 'INBOX',
      secret: tokens.refresh_token,
      authMethod: 'oauth2',
      connectedByUid: state.uid,
    });

    return redirectWithSuccess(returnOrigin);
  } catch (error) {
    const message =
      error instanceof Error ? formatMicrosoftOAuthError(error.message) : 'Error al conectar Microsoft.';
    return redirectWithError(returnOrigin, message);
  }
}
