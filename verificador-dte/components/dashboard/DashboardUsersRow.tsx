'use client';

import Link from 'next/link';
import { ArrowRight, UserCheck, UserMinus, Users } from 'lucide-react';
import { FadeIn } from '@/components/motion/FadeIn';
import type { DashboardUserStats } from '@/lib/dashboard-stats';
import { DashboardStatCard } from './DashboardStatCard';

type DashboardUsersRowProps = {
  users?: DashboardUserStats | null;
  showSkeleton?: boolean;
  manageHref?: string;
};

export function DashboardUsersRow({
  users,
  showSkeleton,
  manageHref = '/usuarios',
}: DashboardUsersRowProps) {
  if (!showSkeleton && !users) return null;

  const scopeLabel =
    users?.scope === 'platform' ? 'Usuarios en la plataforma' : 'Usuarios de la organizacion';

  return (
    <FadeIn delay={0.06}>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-yellow-300">
            {scopeLabel}
          </p>
          {users?.scope === 'organization' ? (
            <Link
              href={manageHref}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:underline dark:text-yellow-400"
            >
              Gestionar usuarios
              <ArrowRight className="size-3.5" />
            </Link>
          ) : users?.scope === 'platform' ? (
            <Link
              href={manageHref}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:underline dark:text-yellow-400"
            >
              Ver todos los usuarios
              <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <DashboardStatCard
            title="Total usuarios"
            value={users?.total ?? 0}
            subtitle={users?.label ?? 'Miembros registrados'}
            icon={Users}
            iconClassName="bg-slate-500/15 text-slate-700 dark:text-slate-300"
            loading={showSkeleton}
          />
          <DashboardStatCard
            title="Activos"
            value={users?.active ?? 0}
            subtitle="Con acceso habilitado"
            icon={UserCheck}
            iconClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            loading={showSkeleton}
          />
          <DashboardStatCard
            title="Inactivos"
            value={users?.inactive ?? 0}
            subtitle="Inactivos o bloqueados"
            icon={UserMinus}
            iconClassName="bg-red-500/15 text-red-600 dark:text-red-400"
            loading={showSkeleton}
          />
        </div>
      </section>
    </FadeIn>
  );
}
