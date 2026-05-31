'use client';

import type { DashboardRecentLog } from '@/lib/dashboard-stats';
import { DteShortcutsGrid } from './DteShortcutsGrid';
import { MobileAppCard } from './MobileAppCard';
import { RecentActivityList } from './RecentActivityList';
import { SecurityTotpCard } from './SecurityTotpCard';

type DashboardActionsBentoProps = {
  recent: DashboardRecentLog[];
  totpEnabled: boolean;
  loading?: boolean;
};

export function DashboardActionsBento({
  recent,
  totpEnabled,
  loading,
}: DashboardActionsBentoProps) {
  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-yellow-300">
        Acciones y seguimiento
      </p>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] xl:grid-rows-[auto_auto_auto] xl:items-stretch">
        <RecentActivityList
          recent={recent}
          loading={loading}
          className="order-1 xl:col-start-1 xl:row-start-1 xl:row-span-2"
        />

        <SecurityTotpCard
          totpEnabled={totpEnabled}
          variant="compact"
          className="order-3 xl:order-none xl:col-start-2 xl:row-start-1"
        />

        <MobileAppCard
          variant="compact"
          className="order-4 xl:order-none xl:col-start-2 xl:row-start-2"
        />

        <DteShortcutsGrid className="order-2 xl:order-none xl:col-span-2 xl:row-start-3" />
      </div>
    </section>
  );
}
