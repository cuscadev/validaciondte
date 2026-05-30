import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getHaciendaTokenForUser } from '@/lib/hacienda-auth';

const GO_DTE_API_URL = process.env.GO_DTE_API_URL || 'http://127.0.0.1:8081';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const incoming = await req.formData();
    const environment = incoming.get('environment') === 'production' ? 'production' : 'test';
    const token = await getHaciendaTokenForUser(user.uid, false, environment);

    const upstreamForm = new FormData();
    upstreamForm.set('environment', environment);

    for (const file of incoming.getAll('files')) {
      if (file instanceof File) {
        upstreamForm.append('files', file, file.name);
      }
    }

    for (const file of incoming.getAll('file')) {
      if (file instanceof File) {
        upstreamForm.append('files', file, file.name);
      }
    }

    const upstream = await fetch(`${GO_DTE_API_URL}/api/hacienda/consulta-dte-lote-json`, {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: upstreamForm,
    });

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo consultar lote DTE desde JSON' },
      { status: 400 }
    );
  }
}
