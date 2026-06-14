'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type SidebarTourItem = {
  href: string;
  label: string;
  children?: { href: string; label: string; group?: string }[];
};

type SidebarTourRegistryContextValue = {
  items: SidebarTourItem[];
  setItems: (items: SidebarTourItem[]) => void;
};

const SidebarTourRegistryContext = createContext<SidebarTourRegistryContextValue | null>(null);

export function SidebarTourRegistryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SidebarTourItem[]>([]);
  const value = useMemo(() => ({ items, setItems }), [items]);

  return (
    <SidebarTourRegistryContext.Provider value={value}>{children}</SidebarTourRegistryContext.Provider>
  );
}

export function useSidebarTourItems() {
  return useContext(SidebarTourRegistryContext)?.items ?? [];
}

export function useRegisterSidebarTourItems(items: SidebarTourItem[]) {
  const registry = useContext(SidebarTourRegistryContext);

  useEffect(() => {
    if (!registry) return;
    registry.setItems(items);
    return () => registry.setItems([]);
  }, [registry, items]);
}
