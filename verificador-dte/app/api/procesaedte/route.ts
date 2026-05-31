export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getGoDteApiUrl } from '@/lib/go-dte-api';

export async function POST(req: Request) {
  const body = await req.text();

  const upstream = await fetch(`${getGoDteApiUrl()}/api/procesaedte`, {
    method: 'POST',
    headers: {
      'content-type': req.headers.get('content-type') || 'application/json',
    },
    body,
  });

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
    },
  });
}
