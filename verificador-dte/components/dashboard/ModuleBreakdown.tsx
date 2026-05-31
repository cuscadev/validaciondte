'use client';

import {
  Activity,
  CalendarDays,
  CheckCircle2,
  FileJson,
  FileText,
  Link2,
  QrCode,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { FadeIn } from '@/components/motion/FadeIn';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardModuleStat } from '@/lib/dashboard-stats';
import { getModuleIconKey } from '@/lib/dashboard-stats';

type ModuleBreakdownProps = {
  byModule: DashboardModuleStat[];
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

const TOP_MODULES = 4;

function resolveIcon(routeKey: string): LucideIcon {
  const key = getModuleIconKey(routeKey);
  return MODULE_ICONS[key] ?? FileText;
}

export function ModuleBreakdown({ byModule, loading, className }: ModuleBreakdownProps) {
  const topModules = byModule.slice(0, TOP_MODULES);
  const maxOutcomes = Math.max(
    ...topModules.map((m) => m.successCount + m.errorCount),
    1
  );

  return (
    <FadeIn delay={0.12} className={className}>
      <Card className="gap-0 py-4">
        <CardHeader className="px-4 pb-3">
          <CardTitle className="text-base">Servicios mas utilizados</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: TOP_MODULES }).map((_, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3"
                >
                  <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-2 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : topModules.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin actividad por modulo en el periodo.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {topModules.map((mod) => {
                const Icon = resolveIcon(mod.routeKey);
                const totalOutcomes = mod.successCount + mod.errorCount;
                const widthPct = Math.max((totalOutcomes / maxOutcomes) * 100, 8);

                return (
                  <article
                    key={`${mod.routeKey}-${mod.moduleName}`}
                    className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/15 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-yellow-400">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {mod.moduleName}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
                            title="Exitosos"
                          >
                            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                            {mod.successCount}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-400"
                            title="Fallidos"
                          >
                            <XCircle className="size-3.5 shrink-0" aria-hidden />
                            {mod.errorCount}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="flex h-full min-w-[8%]"
                        style={{ width: `${widthPct}%` }}
                      >
                        {mod.successCount > 0 && (
                          <div
                            className="h-full bg-emerald-500 dark:bg-emerald-400"
                            style={{
                              width:
                                totalOutcomes > 0
                                  ? `${(mod.successCount / totalOutcomes) * 100}%`
                                  : '0%',
                            }}
                          />
                        )}
                        {mod.errorCount > 0 && (
                          <div
                            className="h-full bg-red-500 dark:bg-red-400"
                            style={{
                              width:
                                totalOutcomes > 0
                                  ? `${(mod.errorCount / totalOutcomes) * 100}%`
                                  : '0%',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
