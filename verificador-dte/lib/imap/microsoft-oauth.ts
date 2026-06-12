import { isAllowedAppOrigin } from '@/lib/app-origin';

const AUTHORIZE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

/** IMAP.AccessAsUser.All permite el login XOAUTH2 contra outlook.office365.com. */
export const MICROSOFT_IMAP_SCOPES = [
  'offline_access',
  'openid',
  'email',
  'profile',
  'https://outlook.office365.com/IMAP.AccessAsUser.All',
];

export type MicrosoftTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  email: string;
};

function getMicrosoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'Microsoft OAuth no esta configurado (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET).'
    );
  }
  return { clientId, clientSecret };
}

export function resolveMicrosoftOAuthRedirectUri(appOrigin: string): string {
  const configured =
    process.env.MICROSOFT_OAUTH_REDIRECT_URI?.trim() ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'https://verificadordtev2.cuscadev.com'}/api/integrations/imap/microsoft/callback`;

  if (!isAllowedAppOrigin(appOrigin)) return configured;

  const dynamic = `${appOrigin.replace(/\/$/, '')}/api/integrations/imap/microsoft/callback`;
  if (dynamic === configured) return configured;

  try {
    const cfg = new URL(configured);
    const dyn = new URL(dynamic);
    if (
      (cfg.hostname === 'localhost' || cfg.hostname === '127.0.0.1') &&
      cfg.hostname === dyn.hostname
    ) {
      return dynamic;
    }
  } catch {
    // ignore
  }

  return configured;
}

export function buildMicrosoftConsentUrl(state: string, redirectUri: string): string {
  const { clientId } = getMicrosoftConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: MICROSOFT_IMAP_SCOPES.join(' '),
    state,
    prompt: 'select_account',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  error?: string;
  error_description?: string;
};

function decodeIdTokenEmail(idToken: string | undefined): string {
  if (!idToken) return '';
  const parts = idToken.split('.');
  if (parts.length < 2) return '';
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      preferred_username?: string;
      email?: string;
      upn?: string;
    };
    return (payload.preferred_username || payload.email || payload.upn || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

async function requestTokens(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || 'No se pudo obtener el token de Microsoft.'
    );
  }
  return json;
}

export async function exchangeMicrosoftCode(
  code: string,
  redirectUri: string
): Promise<MicrosoftTokens> {
  const { clientId, clientSecret } = getMicrosoftConfig();
  const json = await requestTokens(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      scope: MICROSOFT_IMAP_SCOPES.join(' '),
    })
  );

  return {
    accessToken: json.access_token!,
    refreshToken: json.refresh_token || null,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    email: decodeIdTokenEmail(json.id_token),
  };
}

export async function refreshMicrosoftTokens(refreshToken: string): Promise<MicrosoftTokens> {
  const { clientId, clientSecret } = getMicrosoftConfig();
  const json = await requestTokens(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: MICROSOFT_IMAP_SCOPES.join(' '),
    })
  );

  return {
    accessToken: json.access_token!,
    // Microsoft puede rotar el refresh token; si no envia uno nuevo, se conserva el anterior.
    refreshToken: json.refresh_token || null,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    email: decodeIdTokenEmail(json.id_token),
  };
}
