import { NextRequest, NextResponse } from 'next/server';

import { testImapConnection } from '@/lib/imap/client';
import { upsertImapConnection } from '@/lib/imap/firebase-db';
import { getImapPreset } from '@/lib/imap/presets';
import { requireOrgAdmin } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ConnectBody = {
  provider?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  email?: string;
  password?: string;
  consent?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const user = await requireOrgAdmin(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion asignada.' }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as ConnectBody;

    if (!body.consent) {
      return NextResponse.json(
        { error: 'Debes aceptar el consentimiento de lectura del buzon.' },
        { status: 400 }
      );
    }

    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Ingresa un correo valido.' }, { status: 400 });
    }

    const provider = String(body.provider || 'custom').trim();

    let password = String(body.password || '').trim();
    // Google y Yahoo muestran la clave de aplicacion en grupos de 4 con espacios,
    // pero el login requiere la clave sin espacios.
    if (provider === 'gmail' || provider === 'yahoo') {
      password = password.replace(/\s+/g, '');
    }
    if (!password) {
      return NextResponse.json(
        { error: 'Ingresa la clave de aplicacion del correo.' },
        { status: 400 }
      );
    }
    const preset = getImapPreset(provider);
    const host = String(body.host || preset?.host || '').trim().toLowerCase();
    const port = Number(body.port || preset?.port || 993);
    const secure = body.secure !== false;

    if (!host) {
      return NextResponse.json({ error: 'Indica el servidor IMAP (host).' }, { status: 400 });
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return NextResponse.json({ error: 'Puerto IMAP invalido.' }, { status: 400 });
    }
    if (!secure) {
      return NextResponse.json(
        { error: 'Solo se permiten conexiones IMAP con TLS (puerto 993).' },
        { status: 400 }
      );
    }

    await testImapConnection({ host, port, secure, email, password });

    const connection = await upsertImapConnection({
      organizationId: user.organizationId,
      email,
      host,
      port,
      secure,
      provider,
      password,
      connectedByUid: user.uid,
    });

    return NextResponse.json({
      connected: true,
      email: connection.email,
      host: connection.host,
      port: connection.port,
      provider: connection.provider,
      connectedAt: connection.updated_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al conectar IMAP.';
    console.error('[imap/connect]', error);
    const status =
      message === 'No autorizado' ? 401 : message.startsWith('Error IMAP') ? 502 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
