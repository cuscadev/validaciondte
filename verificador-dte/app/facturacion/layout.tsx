'use client';

import { usePathname } from 'next/navigation';

import PlanGate from '@/components/PlanGate';
import { FACTURACION_ROUTE_BY_PATH } from '@/lib/plan-routes';

export default function FacturacionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const routeKey = FACTURACION_ROUTE_BY_PATH[pathname];

  if (!routeKey) {
    return <>{children}</>;
  }

  return <PlanGate routeKey={routeKey}>{children}</PlanGate>;
}
