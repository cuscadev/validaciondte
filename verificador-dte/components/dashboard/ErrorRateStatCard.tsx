'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardErrorRates } from '@/lib/dashboard-stats';
import { cn } from '@/lib/utils';

type ErrorRatePeriod = keyof DashboardErrorRates;

const PERIOD_TABS: { id: ErrorRatePeriod; label: string }[] = [
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensual' },
  { id: 'yearly', label: 'Anual' },
];

type ErrorRateStatCardProps = {
  errorRates?: DashboardErrorRates;
  loading?: boolean;
  className?: string;
};

export function ErrorRateStatCard({
  errorRates,
  loading,
  className,
}: ErrorRateStatCardProps) {
  const [period, setPeriod] = useState<ErrorRatePeriod>('monthly');
  const active = errorRates?.[period];

  return (
    <Card className={cn('h-full gap-0 py-4', className)}>
      <CardHeader className="px-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Tasa de error
          </CardTitle>
          {!loading && errorRates && (
            <div className="inline-flex shrink-0 rounded-md border border-border bg-muted/50 p-0.5">
              {PERIOD_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeriod(tab.id)}
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                    period === tab.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
            <div className="h-3 w-28 animate-pulse rounded-md bg-muted" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-400">
                <AlertTriangle className="size-4" />
              </span>
              {active?.errorRate ?? 0}%
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {active?.errorCount ?? 0} err · {active?.successCount ?? 0} ok
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
