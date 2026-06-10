import { NextRequest, NextResponse } from 'next/server';

import { insertConnection } from '@/lib/email/db';
import {
  assertAccountEmailForImap,
  getProviderPreset,
  inferEmailProvider,
  isEmailProvider,
  normalizeEmailAddress,
} from '@/lib/email/provider-presets';
import { testImapConnection } from '@/lib/email/imap-client';
import { requireOrgAdmin } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireOrgAdmin(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion.' }, { status: 400 });
    }

    const body = (await req.json()) as {
      provider?: string;
      email?: string;
      appPassword?: string;
    };

    const provider = body.provider?.trim() || '';
    const email = normalizeEmailAddress(body.email || '');
    const appPassword = body.appPassword?.trim() || '';
    const accountEmail = normalizeEmailAddress(user.email || '');

    if (!isEmailProvider(provider)) {
      return NextResponse.json({ error: 'Proveedor invalido.' }, { status: 400 });
    }

    try {
      assertAccountEmailForImap({ submittedEmail: email, accountEmail });
    } catch (validationError) {
      return NextResponse.json(
        { error: validationError instanceof Error ? validationError.message : 'Correo invalido.' },
        { status: 400 }
      );
    }

    const inferredProvider = inferEmailProvider(accountEmail);
    if (inferredProvider && inferredProvider !== provider) {
      return NextResponse.json(
        {
          error: `El proveedor debe ser ${getProviderPreset(inferredProvider).label} para ${accountEmail}.`,
        },
        { status: 400 }
      );
    }

    if (!appPassword) {
      return NextResponse.json({ error: 'Indica la contraseña de aplicacion.' }, { status: 400 });
    }

    const preset = getProviderPreset(provider);

    try {
      await testImapConnection({
        emailAddress: email,
        password: appPassword,
        imapHost: preset.imapHost,
        imapPort: preset.imapPort,
        imapSecure: preset.imapSecure,
      });
    } catch {
      const hint =
        provider === 'microsoft'
          ? 'IMAP rechazo las credenciales. Verifica correo, contraseña de aplicacion e IMAP habilitado en Outlook. Si tu cuenta no permite autenticacion basica, el administrador debe habilitarla o usar OAuth2.'
          : 'IMAP rechazo las credenciales. Verifica correo y contraseña de aplicacion.';
      return NextResponse.json({ error: hint }, { status: 400 });
    }

    const connection = await insertConnection({
      organizationId: user.organizationId,
      provider,
      emailAddress: email,
      imapHost: preset.imapHost,
      imapPort: preset.imapPort,
      imapSecure: preset.imapSecure,
      mailboxFolder: 'INBOX',
      secret: appPassword,
      authMethod: 'app_password',
      connectedByUid: user.uid,
    });

    return NextResponse.json({
      connection: {
        id: connection.id,
        provider: connection.provider,
        emailAddress: connection.email_address,
        connectedAt: connection.created_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status =
      message.includes('duplicate') || message.includes('unique')
        ? 409
        : message === 'No autorizado'
          ? 401
          : 500;
    return NextResponse.json(
      {
        error:
          status === 409
            ? 'Esta cuenta ya esta conectada para esta organizacion.'
            : message,
      },
      { status }
    );
  }
}
