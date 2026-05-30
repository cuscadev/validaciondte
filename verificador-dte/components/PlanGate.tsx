'use client';

import { usePlanAccess } from '@/hooks/usePlanAccess';
import { Lock, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface PlanGateProps {
  routeKey: string;
  children: React.ReactNode;
}

/**
 * Envuelve una página de verificación y bloquea el acceso si el plan del usuario no lo permite.
 */
export default function PlanGate({ routeKey, children }: PlanGateProps) {
  const { loading, allowed, membershipType, queryLimit } = usePlanAccess(routeKey);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Verificando acceso...</span>
      </div>
    );
  }

  if (!allowed) {
    const planLabel =
      membershipType === 'free'
        ? 'Free'
        : membershipType === 'premium'
        ? 'Premium'
        : membershipType === 'pro'
        ? 'Pro'
        : membershipType ?? 'actual';

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
          <Lock className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Acceso restringido</h2>
          <p className="text-muted-foreground max-w-sm">
            Tu plan <span className="font-medium">{planLabel}</span> no incluye acceso a esta herramienta.
            {queryLimit !== null && (
              <> Tienes un límite de <span className="font-medium">{queryLimit}</span> consultas por mes.</>
            )}
          </p>
        </div>
        <Link
          href="/configuraciones"
          className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition"
        >
          Ver planes disponibles
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
