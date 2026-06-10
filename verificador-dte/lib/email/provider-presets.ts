export type EmailProvider = 'gmail' | 'yahoo' | 'microsoft';

export type ProviderPreset = {
  provider: EmailProvider;
  label: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  helpText: string;
};

export const EMAIL_PROVIDER_PRESETS: Record<EmailProvider, ProviderPreset> = {
  gmail: {
    provider: 'gmail',
    label: 'Gmail',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
    helpText:
      'Activa verificacion en 2 pasos y crea una contraseña de aplicacion en tu cuenta Google.',
  },
  yahoo: {
    provider: 'yahoo',
    label: 'Yahoo Mail',
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapSecure: true,
    helpText:
      'Genera una contraseña de aplicacion en Seguridad de la cuenta Yahoo e ingresala aqui.',
  },
  microsoft: {
    provider: 'microsoft',
    label: 'Microsoft / Outlook',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
    helpText:
      'Habilita IMAP en Outlook (Settings > Mail > Sync email) y usa una contraseña de aplicacion de Microsoft. Host: outlook.office365.com, puerto 993, SSL.',
  },
};

export function isEmailProvider(value: string): value is EmailProvider {
  return value === 'gmail' || value === 'yahoo' || value === 'microsoft';
}

export function getProviderPreset(provider: EmailProvider): ProviderPreset {
  return EMAIL_PROVIDER_PRESETS[provider];
}

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);
const YAHOO_DOMAINS = new Set(['yahoo.com', 'ymail.com', 'rocketmail.com']);
const MICROSOFT_DOMAINS = new Set([
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'office365.com',
]);

export function inferEmailProvider(email: string): EmailProvider | null {
  const normalized = normalizeEmailAddress(email);
  const at = normalized.lastIndexOf('@');
  if (at <= 0) return null;

  const domain = normalized.slice(at + 1);
  if (GMAIL_DOMAINS.has(domain)) return 'gmail';
  if (YAHOO_DOMAINS.has(domain) || domain.endsWith('.yahoo.com')) return 'yahoo';
  if (MICROSOFT_DOMAINS.has(domain) || domain.endsWith('.onmicrosoft.com')) {
    return 'microsoft';
  }

  return null;
}

export function assertAccountEmailForImap(params: {
  submittedEmail: string;
  accountEmail: string;
}): void {
  const submitted = normalizeEmailAddress(params.submittedEmail);
  const account = normalizeEmailAddress(params.accountEmail);

  if (!account || !account.includes('@')) {
    throw new Error(
      'Tu usuario no tiene correo registrado. Actualiza tu perfil antes de conectar IMAP.'
    );
  }

  if (submitted !== account) {
    throw new Error(
      `Debes conectar el mismo correo con el que iniciaste sesion: ${account}.`
    );
  }
}
