export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { getGoDteApiUrl } from '@/lib/go-dte-api';
import { requireAuth } from '@/lib/server-auth';
import { assertMonthlyUsageLimit } from '@/lib/usage-limits';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const form = await req.formData();
    const routeKey = String(form.get('routeKey') || 'verificadorjson');
    const files = [...form.getAll('files'), ...form.getAll('file')].filter(
      (item): item is File => item instanceof File
    );

    await assertMonthlyUsageLimit(user, routeKey, files.length);

    const upstreamForm = new FormData();
    for (const file of files) {
      upstreamForm.append('files', file, file.name);
    }

    const upstream = await fetch(`${getGoDteApiUrl()}/api/verificararchjson`, {
      method: 'POST',
      body: upstreamForm,
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
