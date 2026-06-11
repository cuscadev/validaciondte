import { NextRequest, NextResponse } from 'next/server';
import { getRouteLabel } from '@/lib/plan-routes';
import { requireAuth } from '@/lib/server-auth';
import { resolveLimitNoticeStatus } from '@/lib/usage-limits';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const routeKey = String(req.nextUrl.searchParams.get('routeKey') || '').trim();

    if (!routeKey) {
      return NextResponse.json({ error: 'routeKey requerido' }, { status: 400 });
    }

    const status = await resolveLimitNoticeStatus(user, routeKey, getRouteLabel);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 500 }
    );
  }
}
