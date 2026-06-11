import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { assertMonthlyUsageLimit, assertBatchProcessLimit, resolveEffectiveRenewalConfig, resolveEffectiveUsageLimit, resolveEffectiveBatchLimit, getMonthlyRouteUsage } from '@/lib/usage-limits';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const routeKey = String(body?.routeKey || '').trim();
    const incomingRecords = Math.max(0, Number(body?.incomingRecords || 0));

    if (!routeKey) {
      return NextResponse.json({ error: 'routeKey requerido' }, { status: 400 });
    }

    const limit = await resolveEffectiveUsageLimit(user, routeKey);
    const batchLimit = await resolveEffectiveBatchLimit(user, routeKey);
    const renewal = await resolveEffectiveRenewalConfig(user);
    const used = limit === null
      ? 0
      : await getMonthlyRouteUsage(
          user.uid,
          routeKey,
          new Date(),
          renewal.resetDayOfMonth,
          renewal.automaticReset,
          renewal.renewalDate
        );
    await assertBatchProcessLimit(user, routeKey, incomingRecords);
    await assertMonthlyUsageLimit(user, routeKey, incomingRecords);

    return NextResponse.json({
      allowed: true,
      limit,
      batchLimit,
      used,
      incomingRecords,
      ...renewal,
      remaining: limit === null ? null : Math.max(0, limit - used - incomingRecords),
    });
  } catch (error) {
    return NextResponse.json(
      {
        allowed: false,
        error: error instanceof Error ? error.message : 'Limite alcanzado',
      },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 403 }
    );
  }
}
