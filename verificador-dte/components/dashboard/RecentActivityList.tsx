'use client';

import {
  Activity,
  CalendarDays,
  FileJson,
  FileText,
  Link2,
  QrCode,
  type LucideIcon,
} from 'lucide-react';
import { FadeIn } from '@/components/motion/FadeIn';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardRecentLog } from '@/lib/dashboard-stats';
import { getModuleIconKey } from '@/lib/dashboard-stats';
import { cn } from '@/lib/utils';

type RecentActivityListProps = {
  recent: DashboardRecentLog[];
  loading?: boolean;
  className?: string;
};

const MODULE_ICONS: Record<string, LucideIcon> = {
  verificador: Link2,
  verificarodyfecha: CalendarDays,
  verificadorjson: FileJson,
  'qr-pdf': QrCode,
  activity: Activity,
};

function resolveIcon(routeKey: string): LucideIcon {
  const key = getModuleIconKey(routeKey);
  return MODULE_ICONS[key] ?? FileText;
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-SV', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function outcomeBorderClass(outcome: DashboardRecentLog['outcome']) {
  if (outcome === 'success') {
    return 'border-l-emerald-500';
  }
  if (outcome === 'partial') {
    return 'border-l-primary';
  }
  return 'border-l-red-500';
}

export function RecentActivityList({
  recent,
  loading,
  className,
}: RecentActivityListProps) {
  return (
    <FadeIn delay={0.14} className={cn('h-full', className)}>
      <Card className="flex h-full flex-col gap-0 border-border/60 bg-muted/10 py-4">
        <CardHeader className="px-4 pb-3">
          <CardTitle className="text-base">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col px-4">
          {loading ? (
            <ul className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <li
                  key={i}
                  className="flex animate-pulse items-center gap-3 rounded-lg border border-l-4 border-l-muted p-2.5"
                >
                  <div className="size-8 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 rounded bg-muted" />
                    <div className="h-2 w-24 rounded bg-muted" />
                  </div>
                </li>
              ))}
            </ul>
          ) : recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay procesos recientes.
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((log) => {
                const Icon = resolveIcon(log.routeKey);
                const hasOutcomes = log.successCount > 0 || log.errorCount > 0;

                return (
                  <li
                    key={log.id}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border border-l-4 border-border bg-card/80 p-2.5',
                      outcomeBorderClass(log.outcome)
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{log.moduleName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                        {hasOutcomes && (
                          <>
                            {' · '}
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {log.successCount} ok
                            </span>
                            {' · '}
                            <span className="text-red-600 dark:text-red-400">
                              {log.errorCount} err
                            </span>
                          </>
                        )}
                        {!hasOutcomes && <> · {log.totalRecords} DTEs</>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
