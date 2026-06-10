import { adminDb } from '@/lib/firebase-admin';
import type { AuthUser } from '@/lib/server-auth';
import type { MembershipType } from '@/lib/firestoreUser';
import {
  DEFAULT_FREE_ROUTES,
  DEFAULT_PREMIUM_ROUTES,
  DEFAULT_PRO_ROUTES,
  PLAN_ROUTE_GROUPS,
} from '@/lib/plan-routes';

type PlanConfig = {
  allowedRoutes?: string[];
};

const DEFAULT_ROUTE_CONFIGS: Record<MembershipType, PlanConfig> = {
  free: { allowedRoutes: DEFAULT_FREE_ROUTES },
  premium: { allowedRoutes: DEFAULT_PREMIUM_ROUTES },
  pro: { allowedRoutes: DEFAULT_PRO_ROUTES },
};

const ALL_PLAN_ROUTE_KEYS = PLAN_ROUTE_GROUPS.flatMap((group) =>
  group.routes.map((route) => route.key)
);

const ROUTE_LABELS = new Map(
  PLAN_ROUTE_GROUPS.flatMap((group) =>
    group.routes.map((route) => [route.key, route.label] as const)
  )
);

function fallbackConfigFor(planType: string): PlanConfig {
  return DEFAULT_ROUTE_CONFIGS[planType as MembershipType] ?? DEFAULT_ROUTE_CONFIGS.free;
}

async function getPlanConfig(membershipType: MembershipType): Promise<PlanConfig> {
  const snap = await adminDb.doc('config/plans').get();
  const plans = snap.data() as Record<string, PlanConfig> | undefined;
  return plans?.[membershipType] ?? fallbackConfigFor(membershipType);
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
  return plan.allowedRoutes ?? fallbackConfigFor(membershipType).allowedRoutes ?? [];
}
