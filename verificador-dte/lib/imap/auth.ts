import { decryptImapSecret, encryptImapSecret } from '@/lib/imap/credentials-crypto';
import { updateImapConnectionTokens } from '@/lib/imap/firebase-db';
import { refreshMicrosoftTokens } from '@/lib/imap/microsoft-oauth';
import type { ImapConnectionConfig, ImapConnectionRow } from '@/lib/imap/types';

/**
 * Construye la configuracion de conexion IMAP para una conexion guardada,
 * refrescando el access token de Microsoft si esta vencido o por vencer.
 */
export async function buildImapConfig(
  connection: ImapConnectionRow
): Promise<ImapConnectionConfig> {
  const base = {
    host: connection.host,
    port: connection.port,
    secure: connection.secure,
    email: connection.email,
  };

  if (connection.auth_type !== 'oauth') {
    return { ...base, password: decryptImapSecret(connection.password_enc) };
  }

  if (!connection.refresh_token_enc) {
    throw new Error('La conexion Microsoft no tiene token guardado. Vuelve a conectar la cuenta.');
  }

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
  const isValid =
    connection.access_token && expiresAt && expiresAt.getTime() > Date.now() + 60_000;

  if (isValid) {
    return { ...base, accessToken: connection.access_token! };
  }

  const refreshToken = decryptImapSecret(connection.refresh_token_enc);
  const tokens = await refreshMicrosoftTokens(refreshToken);
  await updateImapConnectionTokens(connection.organization_id, {
    accessToken: tokens.accessToken,
    tokenExpiresAt: tokens.expiresAt,
    refreshTokenEnc: tokens.refreshToken ? encryptImapSecret(tokens.refreshToken) : undefined,
  });

  return { ...base, accessToken: tokens.accessToken };
}
