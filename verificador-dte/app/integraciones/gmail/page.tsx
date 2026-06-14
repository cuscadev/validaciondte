import { redirect } from 'next/navigation';

export default function GmailIntegrationRedirectPage() {
  redirect('/integraciones/correo-imap');
}
