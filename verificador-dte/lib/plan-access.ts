import { adminDb } from '@/lib/firebase-admin';
import type { AuthUser } from '@/lib/server-auth';
import type { MembershipType } from '@/lib/firestoreUser';
import {
  ALL_PLAN_ROUTE_KEYS,
  DEFAULT_FREE_ROUTES,
  FALLBACK_PLAN_ROUTES,
  getFallbackRoutesForPlan,
  PLAN_ROUTE_GROUPS,
} from '@/lib/plan-routes';
import { resolveEffectiveRoutes } from '@/lib/route-access-overrides';

type PlanConfig = {
  allowedRoutes?: string[];
};

const ROUTE_LABELS = new Map(
  PLAN_ROUTE_GROUPS.flatMap((group) =>
    group.routes.map((route) => [route.key, route.label] as const),
  ),
);

async function getPlanConfig(membershipType: MembershipType): Promise<PlanConfig> {
  const snap = await adminDb.doc('config/plans').get();
  const plans = snap.data() as Record<string, PlanConfig> | undefined;
  return plans?.[membershipType] ?? { allowedRoutes: getFallbackRoutesForPlan(membershipType) };
}

export function getRouteLabel(routeKey: string): string {
  return ROUTE_LABELS.get(routeKey) ?? routeKey;
}

export async function resolveAllowedRoutes(user: AuthUser): Promise<string[]> {
  if (user.role === 'superadmin') {
    return ALL_PLAN_ROUTE_KEYS;
  }

  const membershipType = (user.membership?.type || 'free') as MembershipType;
  const plan = await getPlanConfig(membershipType);
  const planRoutes =
    plan.allowedRoutes ?? FALLBACK_PLAN_ROUTES[membershipType] ?? DEFAULT_FREE_ROUTES;

  return resolveEffectiveRoutes(planRoutes, user.routeAccess);
}
