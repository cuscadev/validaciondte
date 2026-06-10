import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { AppUser } from '@/lib/firestoreUser';
import { PLAN_ROUTE_GROUPS } from '@/lib/plan-routes';
import { requireSuperadmin } from '@/lib/server-auth';
import {
  adjustMonthlyRouteUsage,
  getMonthlyRouteUsage,
  getMonthlyRouteUsageFromLogs,
  getUsageAdjustment,
  getUsagePeriodKey,
  getUsagePeriodStart,
  resolveEffectiveRenewalConfig,
  resolveEffectiveUsageLimit,
  type UsageAdjustmentAction,
} from '@/lib/usage-limits';

const ROUTE_KEYS = new Set(PLAN_ROUTE_GROUPS.flatMap((group) => group.routes.map((route) => route.key)));

async function getTargetUser(uid: string) {
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) return null;
  const data = (snap.data() || {}) as Partial<AppUser>;
  return {
    ...data,
    uid,
    email: String(data.email || ''),
    role: data.role || 'cliente',
    membership: data.membership || { type: 'free', expiresAt: '' },
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireSuperadmin(req);
    const uid = String(req.nextUrl.searchParams.get('uid') || '').trim();
    if (!uid) {
      return NextResponse.json({ error: 'uid requerido' }, { status: 400 });
    }

    const user = await getTargetUser(uid);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const renewal = await resolveEffectiveRenewalConfig(user);
    const monthKey = getUsagePeriodKey(
      new Date(),
      renewal.resetDayOfMonth,
      renewal.automaticReset,
      renewal.renewalDate
    );
    const periodStart = getUsagePeriodStart(
      new Date(),
      renewal.resetDayOfMonth,
      renewal.automaticReset,
      renewal.renewalDate
    );
    const routes = await Promise.all(
      PLAN_ROUTE_GROUPS.flatMap((group) =>
        group.routes.map(async (route) => {
          const [limit, used, fromLogs, adjustment] = await Promise.all([
            resolveEffectiveUsageLimit(user, route.key),
            getMonthlyRouteUsage(
              uid,
              route.key,
              new Date(),
              renewal.resetDayOfMonth,
              renewal.automaticReset,
              renewal.renewalDate
            ),
            getMonthlyRouteUsageFromLogs(
              uid,
              route.key,
              new Date(),
              renewal.resetDayOfMonth,
              renewal.automaticReset,
              renewal.renewalDate
            ),
            getUsageAdjustment(uid, route.key, monthKey),
          ]);

          return {
            key: route.key,
            label: route.label,
            groupKey: group.key,
            groupLabel: group.label,
            limit,
            used,
            fromLogs,
            adjustment,
            remaining: limit === null ? null : Math.max(0, limit - used),
          };
        })
      )
    );

    return NextResponse.json({
      uid,
      monthKey,
      ...renewal,
      periodStart: periodStart.toISOString(),
      routes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireSuperadmin(req);
    const body = await req.json();
    const uid = String(body?.uid || '').trim();
    const routeKey = String(body?.routeKey || '').trim();
    const action = String(body?.action || '').trim() as UsageAdjustmentAction;
    const amount = Number(body?.amount || 0);

    if (!uid || !routeKey || !ROUTE_KEYS.has(routeKey)) {
      return NextResponse.json({ error: 'Usuario o modulo invalido' }, { status: 400 });
    }
    if (!['increment', 'decrement', 'set'].includes(action)) {
      return NextResponse.json({ error: 'Accion invalida' }, { status: 400 });
    }

    const user = await getTargetUser(uid);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const renewal = await resolveEffectiveRenewalConfig(user);
    const result = await adjustMonthlyRouteUsage({
      uid,
      routeKey,
      action,
      amount,
      resetDayOfMonth: renewal.resetDayOfMonth,
      automaticReset: renewal.automaticReset,
      renewalDate: renewal.renewalDate,
      actorUid: actor.uid,
    });
    const limit = await resolveEffectiveUsageLimit(user, routeKey);

    return NextResponse.json({
      success: true,
      routeKey,
      limit,
      ...result,
      remaining: limit === null ? null : Math.max(0, limit - result.used),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 500 }
    );
  }
}
