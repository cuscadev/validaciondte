'use client';

import { Activity, FileStack, RefreshCw, Smartphone } from 'lucide-react';
import { FadeIn } from '@/components/motion/FadeIn';
import { Button } from '@/components/ui/button';
import type { DashboardStatsResponse } from '@/lib/dashboard-stats';
import { cn } from '@/lib/utils';
import { DashboardStatCard } from './DashboardStatCard';
import { ErrorRateStatCard } from './ErrorRateStatCard';

type DashboardMetricsRowProps = {
  stats?: DashboardStatsResponse;
  showSkeleton?: boolean;
  isRefetching?: boolean;
  onRefresh?: () => void;
  className?: string;
  bento?: boolean;
};

export function DashboardMetricsRow({
  stats,
  showSkeleton,
  isRefetching,
  onRefresh,
  className,
  bento = false,
}: DashboardMetricsRowProps) {
  const totals = stats?.totals;
  const mobile = stats?.mobile;
  const errorRates = stats?.errorRates;

  const metricCardClass = bento ? 'min-h-[6.75rem] !py-3' : undefined;

  const cards = (
    <>
      <DashboardStatCard
        title="DTEs procesados (30 días)"
        value={totals?.records ?? 0}
        subtitle={`${totals?.processes ?? 0} procesos`}
        icon={FileStack}
        iconClassName="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
        loading={showSkeleton}
        className={cn(metricCardClass, bento && 'lg:col-start-1 lg:row-start-2')}
      />
      <DashboardStatCard
        title="Procesos realizados"
        value={totals?.processes ?? 0}
        subtitle="Web y extractores"
        icon={Activity}
        iconClassName="bg-blue-500/15 text-blue-600 dark:text-blue-400"
        loading={showSkeleton}
        className={cn(metricCardClass, bento && 'lg:col-start-2 lg:row-start-2')}
      />
      <ErrorRateStatCard
        errorRates={errorRates}
        loading={showSkeleton}
        className={cn(metricCardClass, bento && 'lg:col-start-3 lg:row-start-2')}
      />
      <DashboardStatCard
        title="Escaneos movil"
        value={mobile?.totalScans ?? 0}
        subtitle={
          mobile?.pendingBatches
            ? `${mobile.pendingBatches} lote(s) pendiente(s)`
            : 'Desde KaiserQRmobile'
        }
        icon={Smartphone}
        iconClassName="bg-violet-500/15 text-violet-600 dark:text-violet-400"
        loading={showSkeleton}
        className={cn(metricCardClass, bento && 'lg:col-start-4 lg:row-start-2')}
      />
    </>
  );

  if (bento) {
    return (
      <FadeIn delay={0.05} className={cn('flex flex-col gap-3 lg:contents', className)}>
        <div className="flex items-center justify-between gap-3 lg:col-span-4 lg:col-start-1 lg:row-start-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-yellow-300">
            Actividad
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={showSkeleton || isRefetching}
            className="h-8 gap-2"
          >
            <RefreshCw
              className={cn('size-3.5', isRefetching && 'animate-spin')}
            />
            {isRefetching ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:contents">{cards}</div>
      </FadeIn>
    );
  }

  return (
    <FadeIn delay={0.05} className={className}>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-yellow-300">
            Actividad
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={showSkeleton || isRefetching}
            className="h-8 gap-2"
          >
            <RefreshCw
              className={cn('size-3.5', isRefetching && 'animate-spin')}
            />
            {isRefetching ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards}</div>
      </section>
    </FadeIn>
  );
}
