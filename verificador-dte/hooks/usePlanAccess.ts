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
} from '@/lib/plan-routes';

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
    queryLimit: 10,
    mobileScanFolderLimit: 25,
    price: 0,
    currency: 'USD',
    billingCycle: 'mensual',
    dateFrom: '',
    dateTo: '',
  },
  premium: {
    allowedRoutes: DEFAULT_PREMIUM_ROUTES,
    queryLimit: 100,
    mobileScanFolderLimit: 50,
    price: 19.99,
    currency: 'USD',
    billingCycle: 'mensual',
    dateFrom: '',
    dateTo: '',
  },
  pro: {
    allowedRoutes: DEFAULT_PRO_ROUTES,
    queryLimit: null,
    mobileScanFolderLimit: 100,
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

function hasRouteAccess(config: PlanConfig | null, routeKey: string) {
  if (!config) return false;
  return config.allowedRoutes.includes(routeKey);
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

  useEffect(() => {
    let unsubPlan: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAllowed(false);
        setIsSuperadmin(false);
        setLoading(false);
        return;
      }

      const appUser = await queryClient.fetchQuery({
        queryKey: ['users', user.uid],
        queryFn: () => getUser(user.uid),
        staleTime: QUERY_CACHE_MS,
        gcTime: QUERY_CACHE_MS,
      });

      // superadmin siempre tiene acceso
      if (appUser?.role === 'superadmin') {
        setIsSuperadmin(true);
        setAllowed(true);
        setQueryLimit(null);
        setMembershipType('superadmin');
        setLoading(false);
        return;
      }

      setIsSuperadmin(false);

      const planType = appUser?.membership?.type ?? 'free';
      setMembershipType(planType);

      // Suscripción en tiempo real al config de planes
      unsubPlan = onSnapshot(doc(db, 'config', 'plans'), (snap) => {
        if (!snap.exists()) {
          const fallbackCfg = fallbackConfigFor(planType);
          setPlanConfig(fallbackCfg);
          setQueryLimit(fallbackCfg.queryLimit);
          setAllowed(hasRouteAccess(fallbackCfg, routeKey));
          setLoading(false);
          return;
        }

        const data = snap.data();
        const cfg = data[planType] as PlanConfig | undefined;
        const fallbackCfg = fallbackConfigFor(planType);

        if (!cfg) {
          setPlanConfig(fallbackCfg);
          setQueryLimit(fallbackCfg.queryLimit);
          setAllowed(hasRouteAccess(fallbackCfg, routeKey));
          setLoading(false);
          return;
        }

        setPlanConfig(cfg);
        setQueryLimit(cfg.queryLimit);
        setAllowed(hasRouteAccess(cfg, routeKey));
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      unsubPlan?.();
    };
  }, [queryClient, routeKey]);

  return { loading, allowed, queryLimit, membershipType, planConfig, isSuperadmin };
}

export function useCurrentPlanConfig(): CurrentPlanConfigResult {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [queryLimit, setQueryLimit] = useState<number | null>(null);
  const [membershipType, setMembershipType] = useState<string | null>(null);
  const [planConfig, setPlanConfig] = useState<PlanConfig | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    let unsubPlan: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsSuperadmin(false);
        setPlanConfig(null);
        setQueryLimit(null);
        setMembershipType(null);
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
        setLoading(false);
        return;
      }

      setIsSuperadmin(false);
      const planType = appUser?.membership?.type ?? 'free';
      setMembershipType(planType);

      unsubPlan = onSnapshot(doc(db, 'config', 'plans'), (snap) => {
        const fallbackCfg = fallbackConfigFor(planType);

        if (!snap.exists()) {
          setPlanConfig(fallbackCfg);
          setQueryLimit(fallbackCfg.queryLimit);
          setLoading(false);
          return;
        }

        const data = snap.data();
        const cfg = (data[planType] as PlanConfig | undefined) ?? fallbackCfg;
        setPlanConfig(cfg);
        setQueryLimit(cfg.queryLimit);
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      unsubPlan?.();
    };
  }, [queryClient]);

  return {
    loading,
    allowedRoutes: planConfig?.allowedRoutes ?? [],
    queryLimit,
    membershipType,
    planConfig,
    isSuperadmin,
  };
}
