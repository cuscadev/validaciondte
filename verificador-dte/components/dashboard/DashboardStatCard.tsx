'use client';

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type DashboardStatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconClassName?: string;
  className?: string;
  loading?: boolean;
};

export function DashboardStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
  className,
  loading,
}: DashboardStatCardProps) {
  return (
    <Card className={cn('h-full gap-0 py-4', className)}>
      <CardHeader className="px-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
            {subtitle !== undefined && (
              <div className="h-3 w-28 animate-pulse rounded-md bg-muted" />
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  iconClassName ?? 'bg-primary/15 text-primary'
                )}
              >
                <Icon className="size-4" />
              </span>
              {value}
            </div>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
