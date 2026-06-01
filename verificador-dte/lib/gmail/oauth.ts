import jwt from 'jsonwebtoken';
import { google } from 'googleapis';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'openid',
  'email',
  'profile',
];

export type OAuthStatePayload = {
  organizationId: string;
  uid: string;
  nonce: string;
  /** Origen donde el usuario inició OAuth (p. ej. http://localhost:3001). */
  returnOrigin?: string;
  /** redirect_uri usado con Google (debe coincidir en el callback). */
  redirectUri?: string;
};

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/gmail/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth no configurado (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
  }

  return { clientId, clientSecret, redirectUri };
}

export function createOAuth2Client(redirectUriOverride?: string) {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUriOverride?.trim() || redirectUri
  );
}

export function signOAuthState(payload: OAuthStatePayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Falta JWT_SECRET.');
  return jwt.sign(payload, secret, { expiresIn: '15m' });
}

export function verifyOAuthState(token: string): OAuthStatePayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Falta JWT_SECRET.');
  return jwt.verify(token, secret) as OAuthStatePayload;
}

export function buildConsentUrl(state: string, redirectUri?: string): string {
  const client = createOAuth2Client(redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCodeForTokens(code: string, redirectUri?: string) {
  const client = createOAuth2Client(redirectUri);
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function refreshAccessToken(refreshToken: string) {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  return credentials;
}

export async function revokeRefreshToken(refreshToken: string) {
  const client = createOAuth2Client();
  await client.revokeToken(refreshToken);
}

export { GMAIL_SCOPES };
