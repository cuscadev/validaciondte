export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { getGoDteApiUrl } from '@/lib/go-dte-api';
import { requireAuth } from '@/lib/server-auth';
import { assertMonthlyUsageLimit } from '@/lib/usage-limits';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const payload = await req.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const routeKey = String(payload?.routeKey || 'verificacion_individual');

    await assertMonthlyUsageLimit(user, routeKey, items.length);

    const body = JSON.stringify(payload);

    const upstream = await fetch(`${getGoDteApiUrl()}/api/procesaedte`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body,
    });

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 403 }
    );
  }
}
