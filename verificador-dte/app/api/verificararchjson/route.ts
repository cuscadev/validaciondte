export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getGoDteApiUrl } from '@/lib/go-dte-api';

export async function POST(req: Request) {
  const body = Buffer.from(await req.arrayBuffer());
  const contentType = req.headers.get('content-type') || 'multipart/form-data';

  const upstream = await fetch(`${getGoDteApiUrl()}/api/verificararchjson`, {
    method: 'POST',
    headers: {
      'content-type': contentType,
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
