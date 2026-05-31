export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getGoDteApiUrl } from '@/lib/go-dte-api';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: Params) {
  const { id } = await context.params;
  const upstream = await fetch(`${getGoDteApiUrl()}/api/dte/jobs/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
    },
  });
}
