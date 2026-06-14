import nodemailer from 'nodemailer';
import { adminDb } from '@/lib/firebase-admin';
import { getAppBaseUrl } from '@/lib/app-url';

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
}

export function generateSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$!%*?&';
  return Array.from({ length: 14 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getMailBrandColors() {
  return {
    accent: '#00d1ff',
    accentText: '#0f1419',
    headerBg: '#1a1e23',
    panelBg: '#24292e',
  };
}

function renderBrandedEmail({
  preheader,
  title,
  eyebrow,
  intro,
  highlight,
  highlightLabel,
  actionLabel,
  actionHref,
  details = [],
}: {
  preheader: string;
  title: string;
  eyebrow: string;
  intro: string;
  highlight?: string;
  highlightLabel?: string;
  actionLabel?: string;
  actionHref?: string;
  details?: string[];
}) {
  const baseUrl = getAppBaseUrl();
  const logoUrl = `${baseUrl}/TemaDarkLogo.png`;
  const safeDetails = details.filter(Boolean);
  const brand = getMailBrandColors();

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e4e4e7;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px rgba(24,24,27,0.10);">
            <tr>
              <td style="background:${brand.headerBg};padding:28px 30px;border-bottom:4px solid ${brand.accent};">
                <img src="${logoUrl}" width="150" alt="KayDTe" style="display:block;max-width:150px;height:auto;margin:0 0 22px 0;">
                <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:${brand.accent};font-weight:700;">${escapeHtml(eyebrow)}</div>
                <h1 style="margin:10px 0 0 0;color:#ffffff;font-size:26px;line-height:1.2;font-weight:800;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <p style="margin:0 0 20px 0;color:#3f3f46;font-size:16px;line-height:1.65;">${escapeHtml(intro)}</p>

                ${highlight ? `
                <div style="margin:24px 0;padding:22px;border-radius:14px;background:${brand.panelBg};border:1px solid #27272a;text-align:center;">
                  ${highlightLabel ? `<div style="margin-bottom:10px;color:${brand.accent};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;">${escapeHtml(highlightLabel)}</div>` : ''}
                  <div style="font-size:30px;line-height:1.2;letter-spacing:0.12em;color:#ffffff;font-weight:800;font-family:Consolas,Monaco,monospace;word-break:break-word;">${escapeHtml(highlight)}</div>
                </div>` : ''}

                ${actionLabel && actionHref ? `
                <div style="margin:28px 0;text-align:center;">
                  <a href="${escapeHtml(actionHref)}" style="display:inline-block;background:${brand.accent};color:${brand.accentText};text-decoration:none;border-radius:12px;padding:14px 22px;font-size:15px;font-weight:800;">${escapeHtml(actionLabel)}</a>
                </div>` : ''}

                ${safeDetails.length ? `
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border-radius:14px;background:#fafafa;border:1px solid #e4e4e7;">
                  ${safeDetails.map((detail) => `
                  <tr>
                    <td style="padding:12px 16px;border-bottom:1px solid #e4e4e7;color:#52525b;font-size:14px;line-height:1.45;">${escapeHtml(detail)}</td>
                  </tr>`).join('')}
                </table>` : ''}

                <p style="margin:22px 0 0 0;color:#71717a;font-size:13px;line-height:1.6;">
                  Si no solicitaste este correo, puedes ignorarlo o contactar al administrador de tu organizacion.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 30px;background:#fafafa;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;line-height:1.6;">
                <strong style="color:#18181b;">KayDTe</strong><br>
                Plataforma de verificacion y control de documentos tributarios electronicos.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function verificationCodeEmail({
  code,
  title = 'Codigo de verificacion',
  intro = 'Usa este codigo para continuar con la verificacion de tu cuenta.',
}: {
  code: string;
  title?: string;
  intro?: string;
}) {
  return {
    text: `${title}\n\n${intro}\n\nCodigo: ${code}\n\nExpira en 10 minutos.`,
    html: renderBrandedEmail({
      preheader: `Tu codigo es ${code}. Expira en 10 minutos.`,
      title,
      eyebrow: 'Seguridad de cuenta',
      intro,
      highlight: code,
      highlightLabel: 'Codigo de 6 digitos',
      details: ['Este codigo expira en 10 minutos.', 'No compartas este codigo con nadie.'],
    }),
  };
}

export function temporaryPasswordEmail({
  temporaryPassword,
  title,
  intro,
  actionHref,
}: {
  temporaryPassword: string;
  title: string;
  intro: string;
  actionHref?: string;
}) {
  const loginUrl = actionHref ?? `${getAppBaseUrl()}/login`;
  return {
    text: `${title}\n\n${intro}\n\nContrasena temporal: ${temporaryPassword}\n\nAccede en: ${loginUrl}\n\nAl iniciar sesion deberas cambiarla.`,
    html: renderBrandedEmail({
      preheader: 'Tienes una contrasena temporal para acceder a KayDTe.',
      title,
      eyebrow: 'Acceso KayDTe',
      intro,
      highlight: temporaryPassword,
      highlightLabel: 'Contrasena temporal',
      actionLabel: 'Iniciar sesion',
      actionHref: loginUrl,
      details: ['Al iniciar sesion se te pedira cambiar esta contrasena.', 'Luego completa tu perfil fiscal (conoce a tu cliente).', 'Por seguridad, no compartas esta contrasena.'],
    }),
  };
}

export function collaboratorInviteEmail({
  organizationName,
  inviteUrl,
}: {
  organizationName: string;
  inviteUrl: string;
}) {
  return {
    text: `Has sido invitado a ${organizationName} en KayDTe.\n\nAcepta la invitacion y establece tu contrasena aqui: ${inviteUrl}\n\nEste enlace es distinto a una solicitud de acceso publica: no necesitas codigo de verificacion, solo abrir el enlace y crear tu contrasena.`,
    html: renderBrandedEmail({
      preheader: `Te invitaron a unirte a ${organizationName} en KayDTe`,
      title: 'Unete al equipo',
      eyebrow: organizationName,
      intro: `Fuiste invitado a ${organizationName} en Kaiser DTE. Abre el enlace, crea tu contrasena y listo: no es una solicitud de acceso publica ni requiere codigo de verificacion.`,
      actionLabel: 'Aceptar invitacion',
      actionHref: inviteUrl,
      details: [
        'Este enlace es personal y solo debe usarse una vez.',
        'Despues de establecer tu contrasena podras iniciar sesion normalmente.',
        'Si ves la pantalla de solicitud de acceso, abre el enlace del correo de invitacion (no uses /signup).',
      ],
    }),
  };
}

export function smtpTestEmail() {
  return {
    text: 'La configuracion SMTP funciona correctamente.',
    html: renderBrandedEmail({
      preheader: 'La configuracion SMTP funciona correctamente.',
      title: 'SMTP configurado correctamente',
      eyebrow: 'Configuracion',
      intro: 'Este correo confirma que KayDTe puede enviar mensajes usando la configuracion SMTP global.',
      details: ['Los correos de verificacion, aprobacion y restablecimiento usaran este remitente.'],
    }),
  };
}

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const snap = await adminDb.collection('config').doc('smtp').get();
  if (!snap.exists) {
    throw new Error('SMTP no esta configurado.');
  }

  const data = snap.data() as Partial<SmtpSettings>;
  if (!data.enabled) throw new Error('SMTP esta deshabilitado.');
  if (!data.host || !data.port || !data.user || !data.password || !data.fromEmail) {
    throw new Error('La configuracion SMTP esta incompleta.');
  }

  return {
    host: data.host,
    port: Number(data.port),
    secure: Boolean(data.secure),
    user: data.user,
    password: data.password,
    fromEmail: data.fromEmail,
    fromName: data.fromName || 'KayDTe',
    enabled: true,
  };
}

export async function sendAppMail({
  to,
  subject,
  text,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}) {
  const settings = await getSmtpSettings();
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.user,
      pass: settings.password,
    },
  });

  await transporter.sendMail({
    from: `"${settings.fromName}" <${settings.fromEmail}>`,
    to,
    subject,
    text,
    html,
    attachments,
  });
}
