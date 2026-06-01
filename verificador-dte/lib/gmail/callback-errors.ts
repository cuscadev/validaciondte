export const GMAIL_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  gmail_api_disabled:
    'Habilita la Gmail API en Google Cloud Console (APIs & Services → Library → Gmail API → Enable) y espera 1–2 minutos antes de sincronizar.',
  no_refresh_token:
    'Google no devolvio refresh_token. Revoca el acceso en myaccount.google.com/permissions e intenta de nuevo.',
  oauth_failed: 'No se pudo completar la conexion con Gmail.',
  missing_params: 'Faltan parametros OAuth.',
};

export function mapGmailCallbackError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes('Gmail API has not been used') ||
    message.includes('gmail.googleapis.com') ||
    message.includes('accessNotConfigured')
  ) {
    return 'gmail_api_disabled';
  }
  if (message.includes('refresh_token')) return 'no_refresh_token';
  if (message.length <= 120 && !message.includes('http')) return message;
  return 'oauth_failed';
}
