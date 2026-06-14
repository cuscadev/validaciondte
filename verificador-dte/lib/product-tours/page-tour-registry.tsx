'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type DashboardTourContext = {
  totpEnabled: boolean;
};

type RegistryValue = {
  dashboard: DashboardTourContext | null;
  setDashboard: (value: DashboardTourContext | null) => void;
};

const PageTourContext = createContext<RegistryValue | null>(null);

export function PageTourRegistryProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<DashboardTourContext | null>(null);
  const value = useMemo(() => ({ dashboard, setDashboard }), [dashboard]);

  return <PageTourContext.Provider value={value}>{children}</PageTourContext.Provider>;
}

export function useDashboardTourContext() {
  return useContext(PageTourContext)?.dashboard ?? null;
}

export function useRegisterDashboardTourContext(context: DashboardTourContext) {
  const registry = useContext(PageTourContext);

  useEffect(() => {
    if (!registry) return;
    registry.setDashboard(context);
    return () => registry.setDashboard(null);
  }, [registry, context.totpEnabled]);
}
