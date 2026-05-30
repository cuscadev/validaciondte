export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GO_DTE_API_URL = process.env.GO_DTE_API_URL || 'http://127.0.0.1:8081';

export async function POST(req: Request) {
  const body = await req.text();

  const upstream = await fetch(`${GO_DTE_API_URL}/api/procesaedte`, {
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
