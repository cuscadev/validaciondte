'use client';

import type { DashboardStatsResponse } from '@/lib/dashboard-stats';
import { useGetQuery } from '@/lib/tanstack-query';
import { useAuth } from '@/components/AuthProvider';
import { useDashboardModuleUsageSync } from '@/hooks/useDashboardModuleUsageSync';

const DASHBOARD_STATS_STALE_MS = 5 * 60_000;

export function useDashboardStats() {
  const { authChecked, isAuthenticated } = useAuth();
  useDashboardModuleUsageSync();

  return useGetQuery<DashboardStatsResponse>({
    queryKey: ['dashboard', 'stats'],
    path: '/api/dashboard/stats',
    enabled: authChecked && isAuthenticated,
    overrides: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: DASHBOARD_STATS_STALE_MS,
      placeholderData: (previous) => previous,
    },
  });
}
