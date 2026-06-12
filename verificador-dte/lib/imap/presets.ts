export type ImapProviderPreset = {
  id: string;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  appPasswordHelpUrl: string | null;
  appPasswordHint: string | null;
};

export const IMAP_PROVIDER_PRESETS: ImapProviderPreset[] = [
  {
    id: 'gmail',
    label: 'Gmail / Google Workspace',
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    appPasswordHelpUrl: 'https://myaccount.google.com/apppasswords',
    appPasswordHint:
      'Activa la verificacion en dos pasos y genera una clave de aplicacion en tu cuenta de Google.',
  },
  {
    id: 'outlook',
    label: 'Outlook / Microsoft 365',
    host: 'outlook.office365.com',
    port: 993,
    secure: true,
    appPasswordHelpUrl:
      'https://support.microsoft.com/es-es/account-billing/5896ed9b-4263-e681-128a-a6f2979a7944',
    appPasswordHint:
      'Genera una contrasena de aplicacion desde la seguridad de tu cuenta Microsoft.',
  },
  {
    id: 'zoho',
    label: 'Zoho Mail',
    host: 'imap.zoho.com',
    port: 993,
    secure: true,
    appPasswordHelpUrl: 'https://accounts.zoho.com/home#security/device_logins',
    appPasswordHint:
      'Habilita IMAP en la configuracion de Zoho Mail y genera una contrasena especifica de aplicacion.',
  },
  {
    id: 'yahoo',
    label: 'Yahoo Mail',
    host: 'imap.mail.yahoo.com',
    port: 993,
    secure: true,
    appPasswordHelpUrl: 'https://login.yahoo.com/myaccount/security/app-password/',
    appPasswordHint: 'Genera una contrasena de aplicacion en la seguridad de tu cuenta Yahoo.',
  },
  {
    id: 'custom',
    label: 'Otro proveedor (configuracion manual)',
    host: '',
    port: 993,
    secure: true,
    appPasswordHelpUrl: null,
    appPasswordHint:
      'Consulta con tu proveedor de correo el servidor IMAP, el puerto y como generar una clave de aplicacion.',
  },
];

export function getImapPreset(id: string): ImapProviderPreset | null {
  return IMAP_PROVIDER_PRESETS.find((preset) => preset.id === id) ?? null;
}
