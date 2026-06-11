export const GMAIL_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  gmail_api_disabled:
    'Habilita la Gmail API en Google Cloud Console (APIs & Services → Library → Gmail API → Enable) y espera 1–2 minutos antes de sincronizar.',
  no_refresh_token:
    'Google no devolvio refresh_token. Revoca el acceso en myaccount.google.com/permissions e intenta de nuevo.',
  oauth_failed: 'No se pudo completar la conexion con Gmail.',
  missing_params: 'Faltan parametros OAuth.',
  email_mismatch:
    'La cuenta de Google autorizada no coincide con el correo ingresado. Intenta de nuevo con la cuenta correcta.',
  oauth_not_configured:
    'Google OAuth no esta configurado. Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel.',
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
  if (
    message.includes('GOOGLE_CLIENT_ID') ||
    message.includes('GOOGLE_CLIENT_SECRET') ||
    message.includes('Google OAuth no configurado')
  ) {
    return 'oauth_not_configured';
  }
  if (message.length <= 120 && !message.includes('http')) return message;
  return 'oauth_failed';
}

export function getGmailPublicErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');

  if (message === 'No autorizado') return 'No autorizado';
  if (message.includes('Sin organizaci')) return 'Sin organizacion asignada.';

  if (
    message.includes('GOOGLE_CLIENT_ID') ||
    message.includes('GOOGLE_CLIENT_SECRET') ||
    message.includes('Google OAuth no configurado')
  ) {
    return GMAIL_OAUTH_ERROR_MESSAGES.oauth_not_configured;
  }

  if (
    message.includes('Gmail API has not been used') ||
    message.includes('gmail.googleapis.com') ||
    message.includes('accessNotConfigured')
  ) {
    return GMAIL_OAUTH_ERROR_MESSAGES.gmail_api_disabled;
  }

  if (message.includes('invalid_grant')) {
    return 'Google revoco o expiro el permiso. Desconecta Gmail y vuelve a conectarlo.';
  }

  if (
    message.includes('FIREBASE_') ||
    message.includes('FIREBASE_SERVICE_ACCOUNT_JSON') ||
    message.includes('Missing required environment variable')
  ) {
    return 'Falta configurar Firebase Admin en Vercel para guardar los documentos Gmail.';
  }

  if (message.length <= 180 && !message.includes('http')) return message;

  return 'No se pudo completar la solicitud de Gmail. Revisa los logs del deployment en Vercel.';
}
