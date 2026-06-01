'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getUser } from '@/lib/firestoreUser';
import { QUERY_CACHE_MS } from '@/components/QueryProvider';

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
    allowedRoutes: ['compras-json', 'ventas-json', 'sujetos-excluidos', 'liquidacion-json'],
    queryLimit: 10,
    mobileScanFolderLimit: 25,
    price: 0,
    currency: 'USD',
    billingCycle: 'mensual',
    dateFrom: '',
    dateTo: '',
  },
  premium: {
    allowedRoutes: [
      'verificador',
      'verificarodyfecha',
      'verificadorjson',
      'verificacion_individual',
      'consulta_lote',
      'plantillas-pdf',
      'compras-json',
      'ventas-json',
      'sujetos-excluidos',
      'liquidacion-json',
      'integraciones-gmail',
    ],
    queryLimit: 100,
    mobileScanFolderLimit: 50,
    price: 19.99,
    currency: 'USD',
    billingCycle: 'mensual',
    dateFrom: '',
    dateTo: '',
  },
  pro: {
    allowedRoutes: [
      'verificador',
      'verificarodyfecha',
      'verificadorjson',
      'verificacion_individual',
      'consulta_lote',
      'plantillas-pdf',
      'compras-json',
      'ventas-json',
      'sujetos-excluidos',
      'liquidacion-json',
      'plantillas-pdf',
      'integraciones-gmail',
    ],
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

  useEffect(() => {
    let unsubPlan: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAllowed(false);
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
        setAllowed(true);
        setQueryLimit(null);
        setMembershipType('superadmin');
        setLoading(false);
        return;
      }

      const planType = appUser?.membership?.type ?? 'free';
      setMembershipType(planType);

      // Suscripción en tiempo real al config de planes
      unsubPlan = onSnapshot(doc(db, 'config', 'plans'), (snap) => {
        if (!snap.exists()) {
          setAllowed(false);
          setLoading(false);
          return;
        }

        const data = snap.data();
        const cfg = data[planType] as PlanConfig | undefined;
        const fallbackCfg = DEFAULT_ROUTE_CONFIGS[planType];

        if (!cfg) {
          if (fallbackCfg) {
            setPlanConfig(fallbackCfg);
            setQueryLimit(fallbackCfg.queryLimit);
            setAllowed(fallbackCfg.allowedRoutes.includes(routeKey));
          } else {
            setAllowed(false);
          }
          setLoading(false);
          return;
        }

        setPlanConfig(cfg);
        setQueryLimit(cfg.queryLimit);
        setAllowed(cfg.allowedRoutes.includes(routeKey));
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      unsubPlan?.();
    };
  }, [queryClient, routeKey]);

  return { loading, allowed, queryLimit, membershipType, planConfig };
}
