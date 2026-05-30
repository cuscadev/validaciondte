import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getHaciendaTokenForUser } from '@/lib/hacienda-auth';

const GO_DTE_API_URL = process.env.GO_DTE_API_URL || 'http://127.0.0.1:8081';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ codigoLote: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { codigoLote } = await params;
    const environment = req.nextUrl.searchParams.get('environment') === 'production'
      ? 'production'
      : 'test';
    const token = await getHaciendaTokenForUser(user.uid, false, environment);

    const upstream = await fetch(
      `${GO_DTE_API_URL}/api/hacienda/consulta-dte-lote/${encodeURIComponent(codigoLote)}?environment=${environment}`,
      {
        headers: {
          Authorization: token,
        },
      }
    );

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo consultar lote DTE' },
      { status: 400 }
    );
  }
}
