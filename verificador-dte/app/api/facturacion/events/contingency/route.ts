export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { postGoFacturacion } from '@/lib/facturacion/go-facturacion-client';
import { getHaciendaTokenForUser } from '@/lib/hacienda-auth';
import { resolveCertificatePassword } from '@/lib/facturacion/certificate-credentials';
import { requireAuth } from '@/lib/server-auth';

async function handleEvent(req: NextRequest, path: string) {
  try {
    const user = await requireAuth(req);
    if (user.role !== 'cliente' && user.role !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const environment = body.environment === 'production' ? 'production' : 'test';
    const passwordPri = await resolveCertificatePassword(user.uid, body.passwordPri as string | undefined);
    const token = await getHaciendaTokenForUser(user.uid, false, environment);

    const response = await postGoFacturacion(path, {
      ...body,
      environment,
      passwordPri,
      transmit: body.transmit !== false,
    }, {
      headers: {
        Authorization: token,
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo procesar el evento';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handleEvent(req, '/api/facturacion/events/contingency/submit');
}
