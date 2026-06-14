export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getGoDteApiUrl } from '@/lib/go-dte-api';
import { requireSuperadmin } from '@/lib/server-auth';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(req: NextRequest, context: RouteContext) {
  try {
    await requireSuperadmin(req);
    const { path } = await context.params;
    const targetPath = `/api/facturacion/${path.map(encodeURIComponent).join('/')}`;
    const url = new URL(req.url);
    const upstreamUrl = `${getGoDteApiUrl()}${targetPath}${url.search}`;
    const body = req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : Buffer.from(await req.arrayBuffer());

    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        'content-type': req.headers.get('content-type') || 'application/json',
        Authorization: req.headers.get('Authorization') || '',
      },
      body,
      cache: 'no-store',
    });

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No autorizado' },
      { status: 401 }
    );
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  return proxy(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return proxy(req, context);
}
