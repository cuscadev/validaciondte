'use client';

import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  FileStack,
  Pencil,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { FadeIn } from '@/components/motion/FadeIn';
import { Card, CardContent } from '@/components/ui/card';
import { useRgbNameReveal } from '@/hooks/useRgbNameReveal';
import { cn } from '@/lib/utils';

export type DashboardHeroStats = {
  records?: number;
  processes?: number;
  errorRate?: number;
  mobileScans?: number;
  mobilePending?: number;
  loading?: boolean;
};

export type ProfileCompletion = {
  progress: number;
};

type DashboardHeroProps = {
  displayName: string;
  photoURL?: string | null;
  role?: string;
  membership: string;
  variant?: 'default' | 'sidebar';
  className?: string;
  stats?: DashboardHeroStats;
  chartsLoading?: boolean;
  profileCompletion?: ProfileCompletion;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

type StatPillProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
  compact?: boolean;
};

function StatPill({ label, value, icon: Icon, accent, compact }: StatPillProps) {
  return (
    <div
      className={cn(
        'flex items-center rounded-xl border border-border bg-card',
        compact ? 'gap-2 p-2' : 'gap-3 p-3'
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg',
          compact ? 'size-8' : 'size-10',
          accent
        )}
      >
        <Icon className={compact ? 'size-4' : 'size-5'} />
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            'font-semibold uppercase tracking-[0.18em] text-muted-foreground',
            compact ? 'text-[9px]' : 'text-[10px]'
          )}
        >
          {label}
        </p>
        <p className={cn('truncate font-bold capitalize', compact ? 'text-xs' : 'text-sm')}>
          {value}
        </p>
      </div>
    </div>
  );
}

type ActivityMetricProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent: string;
  loading?: boolean;
};

function ActivityMetric({ label, value, icon: Icon, accent, loading }: ActivityMetricProps) {
  return (
    <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-card p-2">
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md',
          accent
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {loading ? (
          <div className="mt-0.5 h-4 w-10 animate-pulse rounded bg-muted" />
        ) : (
          <p className="truncate text-sm font-bold leading-tight">{value}</p>
        )}
      </div>
    </div>
  );
}

function DashboardRgbName({
  name,
  chartsLoading = false,
  className,
}: {
  name: string;
  chartsLoading?: boolean;
  className?: string;
}) {
  const revealed = useRgbNameReveal(chartsLoading);

  return (
    <span className={cn('dashboard-rgb-name', className)}>
      <span className={cn('dashboard-rgb-name-base', revealed && 'is-revealed')}>
        {name}
      </span>
      <span
        className={cn('dashboard-rgb-name-fx', revealed ? 'is-revealed' : 'is-loading')}
        aria-hidden="true"
      >
        {name}
      </span>
    </span>
  );
}

export function DashboardHero({
  displayName,
  photoURL,
  role,
  membership,
  variant = 'default',
  className,
  stats,
  chartsLoading = false,
  profileCompletion,
}: DashboardHeroProps) {
  const isSidebar = variant === 'sidebar';

  return (
    <FadeIn className={cn('h-full', className)}>
      <Card
        className={cn(
          'h-full overflow-hidden border-border bg-card py-0 shadow-sm',
          isSidebar && 'relative flex flex-col'
        )}
      >
        {isSidebar && (
          <Link
            href="/profile"
            className="absolute left-3 top-3 z-10 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-white/10/90 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
            aria-label={
              profileCompletion
                ? `Editar perfil, ${profileCompletion.progress}% completado`
                : 'Editar perfil'
            }
            title={
              profileCompletion
                ? `Editar perfil (${profileCompletion.progress}% completado)`
                : 'Editar perfil'
            }
          >
            <span className="relative inline-flex size-8 items-center justify-center">
              <Pencil className="size-3.5" />
              {profileCompletion && (
                <span className="absolute -bottom-1.5 -right-2 rounded-full bg-primary px-1 py-px text-[8px] font-extrabold leading-none text-black shadow-sm">
                  {profileCompletion.progress}%
                </span>
              )}
            </span>
          </Link>
        )}
        <CardContent
          className={cn(
            isSidebar ? 'flex flex-1 flex-col justify-between gap-5 p-4' : 'p-5 md:p-6'
          )}
        >
          {isSidebar ? (
            <>
              <div className="flex flex-col items-center text-center">
                {photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoURL}
                    alt=""
                    className="size-28 shrink-0 rounded-2xl border-2 border-slate-200 object-cover shadow-sm dark:border-white/15"
                  />
                ) : (
                  <div className="flex size-28 shrink-0 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-black shadow-sm">
                    {getInitials(displayName)}
                  </div>
                )}

                <h1 className="mt-4 text-xl font-extrabold leading-snug tracking-tight lg:text-2xl">
                  <DashboardRgbName
                    name={displayName}
                    chartsLoading={chartsLoading}
                    className="block sm:inline"
                  />
                </h1>
                <p className="mt-1.5 text-sm font-semibold capitalize text-muted-foreground">
                  {role ?? 'usuario'}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  Resumen de tu actividad y acceso rapido a tus herramientas DTE.
                </p>
              </div>

              {stats && (
                <div className="flex w-full flex-col gap-2">
                  <ActivityMetric
                    label="DTEs 30d"
                    value={stats.records ?? 0}
                    icon={FileStack}
                    accent="bg-primary/15 text-primary"
                    loading={stats.loading}
                  />
                  <ActivityMetric
                    label="Procesos"
                    value={stats.processes ?? 0}
                    icon={Activity}
                    accent="bg-blue-500/15 text-blue-600 dark:text-blue-400"
                    loading={stats.loading}
                  />
                  <ActivityMetric
                    label="Tasa error"
                    value={`${stats.errorRate ?? 0}%`}
                    icon={AlertTriangle}
                    accent="bg-red-500/15 text-red-600 dark:text-red-400"
                    loading={stats.loading}
                  />
                  <ActivityMetric
                    label="Escaneos"
                    value={stats.mobileScans ?? 0}
                    icon={Smartphone}
                    accent="bg-violet-500/15 text-violet-600 dark:text-violet-400"
                    loading={stats.loading}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <BadgeCheck className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Plan
                  </p>
                  <p className="truncate text-sm font-bold capitalize">{membership}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex gap-4">
                {photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoURL}
                    alt=""
                    className="size-16 shrink-0 rounded-2xl border border-slate-200 object-cover dark:border-white/10 md:size-20"
                  />
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-black md:size-20 md:text-xl">
                    {getInitials(displayName)}
                  </div>
                )}

                <div className="min-w-0">
                  <h1 className="text-2xl font-extrabold tracking-tight md:text-4xl">
                    <DashboardRgbName name={displayName} chartsLoading={chartsLoading} />
                  </h1>
                  <p className="mt-1.5 text-sm font-semibold capitalize text-muted-foreground">
                    {role ?? 'usuario'}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Accede rapido a tus herramientas DTE, revisa tu actividad y
                    refuerza la seguridad de tu cuenta desde un solo lugar.
                  </p>
                </div>
              </div>

              <StatPill
                label="Plan"
                value={membership}
                icon={BadgeCheck}
                accent="bg-blue-500/15 text-blue-700 dark:text-blue-300"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
