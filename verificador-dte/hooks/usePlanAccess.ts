'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getUser } from '@/lib/firestoreUser';
import { QUERY_CACHE_MS } from '@/components/QueryProvider';
import {
  DEFAULT_FREE_ROUTES,
  DEFAULT_PREMIUM_ROUTES,
  DEFAULT_PRO_ROUTES,
  ALL_PLAN_ROUTE_KEYS,
} from '@/lib/plan-routes';
import { resolveEffectiveRoutes } from '@/lib/route-access-overrides';
import type { RouteAccessOverride } from '@/lib/route-access-overrides';

interface PlanConfig {
  allowedRoutes: string[];
  queryLimit: number | null;
  mobileScanFolderLimit: number | null;
  price: number;
  currency: string;
  billingCycle: string;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_ROUTE_CONFIGS: Record<string, PlanConfig> = {
  free: {
    allowedRoutes: DEFAULT_FREE_ROUTES,
    queryLimit: null,
    mobileScanFolderLimit: null,
    price: 0,
    currency: 'USD',
    billingCycle: 'mensual',
    dateFrom: '',
    dateTo: '',
  },
  premium: {
    allowedRoutes: DEFAULT_PREMIUM_ROUTES,
    queryLimit: null,
    mobileScanFolderLimit: null,
    price: 19.99,
    currency: 'USD',
    billingCycle: 'mensual',
    dateFrom: '',
    dateTo: '',
  },
  pro: {
    allowedRoutes: DEFAULT_PRO_ROUTES,
    queryLimit: null,
    mobileScanFolderLimit: null,
    price: 49.99,
    currency: 'USD',
    billingCycle: 'mensual',
    dateFrom: '',
    dateTo: '',
  },
};

interface PlanAccessResult {
  loading: boolean;
  allowed: boolean;
  queryLimit: number | null;
  membershipType: string | null;
  planConfig: PlanConfig | null;
  isSuperadmin: boolean;
}

interface CurrentPlanConfigResult {
  loading: boolean;
  allowedRoutes: string[];
  queryLimit: number | null;
  membershipType: string | null;
  planConfig: PlanConfig | null;
  isSuperadmin: boolean;
}

function hasRouteAccess(
  config: PlanConfig | null,
  routeKey: string,
  routeAccess?: RouteAccessOverride,
) {
  if (!config) return false;
  return resolveEffectiveRoutes(config.allowedRoutes, routeAccess).includes(routeKey);
}

function getEffectiveRoutes(
  config: PlanConfig | null,
  routeAccess?: RouteAccessOverride,
) {
  if (!config) return [];
  return resolveEffectiveRoutes(config.allowedRoutes, routeAccess);
}

function fallbackConfigFor(planType: string) {
  return DEFAULT_ROUTE_CONFIGS[planType] ?? DEFAULT_ROUTE_CONFIGS.free;
}

/**
 * Verifica si el usuario autenticado tiene acceso a una ruta específica según su plan.
 * @param routeKey - clave de la ruta (ej: 'verificador', 'verificadorjson')
 */
export function usePlanAccess(routeKey: string): PlanAccessResult {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [queryLimit, setQueryLimit] = useState<number | null>(null);
  const [membershipType, setMembershipType] = useState<string | null>(null);
  const [planConfig, setPlanConfig] = useState<PlanConfig | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [routeAccessOverride, setRouteAccessOverride] = useState<RouteAccessOverride | undefined>();

  useEffect(() => {
    let unsubPlan: (() => void) | null = null;
    let unsubUser: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      unsubPlan?.();
      unsubUser?.();
      unsubPlan = null;
      unsubUser = null;

      if (!user) {
        setAllowed(false);
        setIsSuperadmin(false);
        setRouteAccessOverride(undefined);
        setLoading(false);
        return;
      }

      const appUser = await queryClient.fetchQuery({
        queryKey: ['users', user.uid],
        queryFn: () => getUser(user.uid),
        staleTime: QUERY_CACHE_MS,
        gcTime: QUERY_CACHE_MS,
      });

      if (appUser?.role === 'superadmin') {
        setIsSuperadmin(true);
        setAllowed(true);
        setQueryLimit(null);
        setMembershipType('superadmin');
        setRouteAccessOverride(undefined);
        setLoading(false);
        return;
      }

      setIsSuperadmin(false);

      const planType = appUser?.membership?.type ?? 'free';
      setMembershipType(planType);
      setRouteAccessOverride(appUser?.routeAccess);

      unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        const data = snap.data() as { routeAccess?: RouteAccessOverride } | undefined;
        setRouteAccessOverride(data?.routeAccess);
      });

      unsubPlan = onSnapshot(doc(db, 'config', 'plans'), (snap) => {
        const fallbackCfg = fallbackConfigFor(planType);
        const cfg = snap.exists()
          ? ((snap.data()[planType] as PlanConfig | undefined) ?? fallbackCfg)
          : fallbackCfg;

        setPlanConfig(cfg);
        setQueryLimit(cfg.queryLimit);
        setAllowed(hasRouteAccess(cfg, routeKey, appUser?.routeAccess));
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      unsubPlan?.();
      unsubUser?.();
    };
  }, [queryClient, routeKey]);

  useEffect(() => {
    if (isSuperadmin || !planConfig) return;
    setAllowed(hasRouteAccess(planConfig, routeKey, routeAccessOverride));
  }, [isSuperadmin, planConfig, routeAccessOverride, routeKey]);

  return { loading, allowed, queryLimit, membershipType, planConfig, isSuperadmin };
}

export function useCurrentPlanConfig(): CurrentPlanConfigResult {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [queryLimit, setQueryLimit] = useState<number | null>(null);
  const [membershipType, setMembershipType] = useState<string | null>(null);
  const [planConfig, setPlanConfig] = useState<PlanConfig | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [routeAccessOverride, setRouteAccessOverride] = useState<RouteAccessOverride | undefined>();
  const [allowedRoutes, setAllowedRoutes] = useState<string[]>([]);

  useEffect(() => {
    let unsubPlan: (() => void) | null = null;
    let unsubUser: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      unsubPlan?.();
      unsubUser?.();
      unsubPlan = null;
      unsubUser = null;

      if (!user) {
        setIsSuperadmin(false);
        setPlanConfig(null);
        setQueryLimit(null);
        setMembershipType(null);
        setRouteAccessOverride(undefined);
        setAllowedRoutes([]);
        setLoading(false);
        return;
      }

      const appUser = await queryClient.fetchQuery({
        queryKey: ['users', user.uid],
        queryFn: () => getUser(user.uid),
        staleTime: QUERY_CACHE_MS,
        gcTime: QUERY_CACHE_MS,
      });

      if (appUser?.role === 'superadmin') {
        setIsSuperadmin(true);
        setPlanConfig(null);
        setQueryLimit(null);
        setMembershipType('superadmin');
        setRouteAccessOverride(undefined);
        setAllowedRoutes(ALL_PLAN_ROUTE_KEYS);
        setLoading(false);
        return;
      }

      setIsSuperadmin(false);
      const planType = appUser?.membership?.type ?? 'free';
      setMembershipType(planType);
      setRouteAccessOverride(appUser?.routeAccess);

      unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        const data = snap.data() as { routeAccess?: RouteAccessOverride } | undefined;
        setRouteAccessOverride(data?.routeAccess);
      });

      unsubPlan = onSnapshot(doc(db, 'config', 'plans'), (snap) => {
        const fallbackCfg = fallbackConfigFor(planType);
        const cfg = snap.exists()
          ? ((snap.data()[planType] as PlanConfig | undefined) ?? fallbackCfg)
          : fallbackCfg;

        setPlanConfig(cfg);
        setQueryLimit(cfg.queryLimit);
        setAllowedRoutes(getEffectiveRoutes(cfg, appUser?.routeAccess));
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      unsubPlan?.();
      unsubUser?.();
    };
  }, [queryClient]);

  useEffect(() => {
    if (isSuperadmin) {
      setAllowedRoutes(ALL_PLAN_ROUTE_KEYS);
      return;
    }
    if (!planConfig) {
      setAllowedRoutes([]);
      return;
    }
    setAllowedRoutes(getEffectiveRoutes(planConfig, routeAccessOverride));
  }, [isSuperadmin, planConfig, routeAccessOverride]);

  return {
    loading,
    allowedRoutes,
    queryLimit,
    membershipType,
    planConfig,
    isSuperadmin,
  };
}
