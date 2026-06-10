import jwt from 'jsonwebtoken';

export const MICROSOFT_IMAP_SCOPES = [
  'https://outlook.office365.com/IMAP.AccessAsUser.All',
  'offline_access',
  'openid',
  'profile',
  'email',
];

export type MicrosoftOAuthStatePayload = {
  organizationId: string;
  uid: string;
  nonce: string;
  returnOrigin?: string;
  redirectUri?: string;
};

export type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  id_token?: string;
};

function getOAuthConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim() || 'common';
  const redirectUri =
    process.env.MICROSOFT_OAUTH_REDIRECT_URI?.trim() ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/email/microsoft/callback`;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Microsoft OAuth no configurado (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET).'
    );
  }

  return { clientId, clientSecret, tenantId, redirectUri };
}

function tokenEndpoint(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

function authorizeEndpoint(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
}

export function signMicrosoftOAuthState(payload: MicrosoftOAuthStatePayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Falta JWT_SECRET.');
  return jwt.sign(payload, secret, { expiresIn: '15m' });
}

export function verifyMicrosoftOAuthState(token: string): MicrosoftOAuthStatePayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Falta JWT_SECRET.');
  return jwt.verify(token, secret) as MicrosoftOAuthStatePayload;
}

export function buildMicrosoftConsentUrl(state: string, redirectUri?: string): string {
  const { clientId, tenantId, redirectUri: defaultRedirect } = getOAuthConfig();
  const uri = redirectUri?.trim() || defaultRedirect;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: uri,
    response_mode: 'query',
    scope: MICROSOFT_IMAP_SCOPES.join(' '),
    state,
    prompt: 'consent',
  });
  return `${authorizeEndpoint(tenantId)}?${params.toString()}`;
}

export async function exchangeMicrosoftCodeForTokens(
  code: string,
  redirectUri?: string
): Promise<MicrosoftTokenResponse> {
  const { clientId, clientSecret, tenantId, redirectUri: defaultRedirect } = getOAuthConfig();
  const uri = redirectUri?.trim() || defaultRedirect;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: uri,
    grant_type: 'authorization_code',
    scope: MICROSOFT_IMAP_SCOPES.join(' '),
  });

  const res = await fetch(tokenEndpoint(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = (await res.json()) as MicrosoftTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!res.ok) {
    const detail = json.error_description || json.error || res.statusText;
    throw new Error(formatMicrosoftOAuthError(detail));
  }

  if (!json.access_token) {
    throw new Error('Microsoft no devolvio access_token.');
  }

  return json;
}

export async function refreshMicrosoftAccessToken(
  refreshToken: string
): Promise<MicrosoftTokenResponse> {
  const { clientId, clientSecret, tenantId } = getOAuthConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: MICROSOFT_IMAP_SCOPES.join(' '),
  });

  const res = await fetch(tokenEndpoint(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = (await res.json()) as MicrosoftTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!res.ok) {
    const detail = json.error_description || json.error || res.statusText;
    throw new Error(formatMicrosoftOAuthError(detail));
  }

  if (!json.access_token) {
    throw new Error('Microsoft no devolvio access_token al refrescar.');
  }

  return json;
}

export function extractEmailFromIdToken(idToken: string): string | null {
  try {
    const payload = jwt.decode(idToken) as Record<string, unknown> | null;
    if (!payload) return null;
    const email =
      (payload.preferred_username as string | undefined) ||
      (payload.email as string | undefined) ||
      (payload.upn as string | undefined);
    return email?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

export function formatMicrosoftOAuthError(detail: string): string {
  const lower = detail.toLowerCase();
  if (lower.includes('aadsts65001') || lower.includes('consent')) {
    return 'Se requiere consentimiento del administrador de Microsoft 365 para acceder al buzon IMAP. Pide a tu admin que apruebe la aplicacion.';
  }
  if (lower.includes('invalid_grant') || lower.includes('expired')) {
    return 'La autorizacion de Microsoft expiro o fue revocada. Intenta conectar de nuevo.';
  }
  return detail;
}

export { getOAuthConfig as getMicrosoftOAuthConfig };
