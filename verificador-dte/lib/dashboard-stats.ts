export type DashboardStatsTotals = {
  processes: number;
  records: number;
  successCount: number;
  errorCount: number;
  successRate: number;
};

export type DailyRollupPoint = {
  date: string;
  processes: number;
  records: number;
  successCount: number;
  errorCount: number;
};

export type ActivityPeriodPoint = {
  key: string;
  label: string;
  successCount: number;
  errorCount: number;
};

export type DashboardErrorRate = {
  errorRate: number;
  successCount: number;
  errorCount: number;
};

export type DashboardErrorRates = {
  weekly: DashboardErrorRate;
  monthly: DashboardErrorRate;
  yearly: DashboardErrorRate;
};

export type DashboardModuleStat = {
  routeKey: string;
  moduleName: string;
  count: number;
  records: number;
  successCount: number;
  errorCount: number;
  /** Monthly authorized limit (null = unlimited). */
  limit?: number | null;
  /** DTEs used in the current billing period. */
  monthlyUsed?: number;
};

export type DashboardRecentLog = {
  id: string;
  moduleName: string;
  routeKey: string;
  outcome: 'success' | 'partial' | 'error';
  totalRecords: number;
  successCount: number;
  errorCount: number;
  createdAt: string | null;
};

export type DashboardMobileStats = {
  pendingBatches: number;
  totalScans: number;
};

export type DashboardUserStats = {
  total: number;
  active: number;
  inactive: number;
  scope: 'organization' | 'platform';
  label: string;
};

export type DashboardStatsResponse = {
  period: { from: string; to: string };
  totals: DashboardStatsTotals;
  weekly: ActivityPeriodPoint[];
  monthly: ActivityPeriodPoint[];
  daily: ActivityPeriodPoint[];
  byModule: DashboardModuleStat[];
  recent: DashboardRecentLog[];
  mobile: DashboardMobileStats;
  errorRates: DashboardErrorRates;
  users?: DashboardUserStats | null;
  activitySource?: 'rollup' | 'logs';
  error?: string;
};

export const DASHBOARD_TIMEZONE = 'America/El_Salvador';
export const DASHBOARD_WEEKLY_PERIODS = 6;
export const DASHBOARD_MONTHLY_PERIODS = 6;
export const DASHBOARD_DAILY_PERIODS = 7;
export const DASHBOARD_ROLLUP_LOOKBACK_DAYS = 180;
export const DASHBOARD_CHART_LOOKBACK_DAYS = 365;

export function getDateKeyInTimezone(
  date: Date,
  timeZone = DASHBOARD_TIMEZONE
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function formatDateKeyFromUtcDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

export function getWeekStartKey(dateKey: string) {
  const date = parseDateKey(dateKey);
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return formatDateKeyFromUtcDate(date);
}

export function formatWeekLabel(weekStartKey: string) {
  const start = parseDateKey(weekStartKey);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  const startLabel = start.toLocaleDateString('es-SV', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const endLabel = end.toLocaleDateString('es-SV', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

  return `${startLabel} – ${endLabel}`;
}

export function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('es-SV', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function getLastNWeekStartKeys(count: number, reference = new Date()) {
  const todayKey = getDateKeyInTimezone(reference);
  const currentWeekStart = getWeekStartKey(todayKey);
  const start = parseDateKey(currentWeekStart);
  const keys: string[] = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const week = new Date(start);
    week.setUTCDate(week.getUTCDate() - i * 7);
    keys.push(formatDateKeyFromUtcDate(week));
  }

  return keys;
}

export function getLastNMonthKeys(count: number, reference = new Date()) {
  const keys: string[] = [];
  const refYear = reference.getFullYear();
  const refMonth = reference.getMonth();

  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(refYear, refMonth - i, 1);
    keys.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    );
  }

  return keys;
}

export function getRollupStartDateKey(reference = new Date()) {
  return getDateKeyInTimezone(
    new Date(reference.getTime() - DASHBOARD_ROLLUP_LOOKBACK_DAYS * 86_400_000)
  );
}

type ActivityLogInput = {
  createdAt: string | null;
  successCount: number;
  errorCount: number;
  outcome?: 'success' | 'partial' | 'error';
  totalRecords?: number;
};

export function normalizeLogOutcomeCounts(log: ActivityLogInput) {
  let successCount = Number(log.successCount || 0);
  let errorCount = Number(log.errorCount || 0);

  if (successCount + errorCount === 0) {
    if (log.outcome === 'error') {
      errorCount = Math.max(Number(log.totalRecords || 0), 1);
    } else if (log.outcome === 'partial') {
      const total = Math.max(Number(log.totalRecords || 0), 1);
      successCount = Math.max(total - 1, 1);
      errorCount = 1;
    } else {
      successCount = Math.max(Number(log.totalRecords || 0), 1);
    }
  }

  return { successCount, errorCount };
}

export function formatDayLabel(dateKey: string) {
  const date = parseDateKey(dateKey);
  return date.toLocaleDateString('es-SV', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function getLastNDateKeys(count: number, reference = new Date()) {
  const todayKey = getDateKeyInTimezone(reference);
  const today = parseDateKey(todayKey);
  const keys: string[] = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - i);
    keys.push(formatDateKeyFromUtcDate(day));
  }

  return keys;
}

export function aggregateDailyToDailyChart(
  daily: DailyRollupPoint[]
): ActivityPeriodPoint[] {
  const dateKeys = getLastNDateKeys(DASHBOARD_DAILY_PERIODS);
  const map = new Map(
    dateKeys.map((key) => [key, { successCount: 0, errorCount: 0 }])
  );

  for (const point of daily) {
    const bucket = map.get(point.date);
    if (!bucket) continue;
    bucket.successCount += point.successCount;
    bucket.errorCount += point.errorCount;
  }

  return dateKeys.map((key) => ({
    key,
    label: formatDayLabel(key),
    successCount: map.get(key)?.successCount ?? 0,
    errorCount: map.get(key)?.errorCount ?? 0,
  }));
}

export function aggregateDailyToWeekly(
  daily: DailyRollupPoint[]
): ActivityPeriodPoint[] {
  const weekKeys = getLastNWeekStartKeys(DASHBOARD_WEEKLY_PERIODS);
  const map = new Map(
    weekKeys.map((key) => [key, { successCount: 0, errorCount: 0 }])
  );

  for (const point of daily) {
    const weekStart = getWeekStartKey(point.date);
    const bucket = map.get(weekStart);
    if (!bucket) continue;
    bucket.successCount += point.successCount;
    bucket.errorCount += point.errorCount;
  }

  return weekKeys.map((key) => ({
    key,
    label: formatWeekLabel(key),
    successCount: map.get(key)?.successCount ?? 0,
    errorCount: map.get(key)?.errorCount ?? 0,
  }));
}

export function aggregateDailyToMonthly(
  daily: DailyRollupPoint[]
): ActivityPeriodPoint[] {
  const monthKeys = getLastNMonthKeys(DASHBOARD_MONTHLY_PERIODS);
  const map = new Map(
    monthKeys.map((key) => [key, { successCount: 0, errorCount: 0 }])
  );

  for (const point of daily) {
    const monthKey = getMonthKey(point.date);
    const bucket = map.get(monthKey);
    if (!bucket) continue;
    bucket.successCount += point.successCount;
    bucket.errorCount += point.errorCount;
  }

  return monthKeys.map((key) => ({
    key,
    label: formatMonthLabel(key),
    successCount: map.get(key)?.successCount ?? 0,
    errorCount: map.get(key)?.errorCount ?? 0,
  }));
}

export function aggregateLogsToDailyPoints(
  logs: ActivityLogInput[]
): DailyRollupPoint[] {
  const map = new Map<string, DailyRollupPoint>();

  for (const log of logs) {
    if (!log.createdAt) continue;

    const { successCount, errorCount } = normalizeLogOutcomeCounts(log);
    const date = getDateKeyInTimezone(new Date(log.createdAt));
    const existing = map.get(date) ?? {
      date,
      processes: 0,
      records: 0,
      successCount: 0,
      errorCount: 0,
    };

    existing.processes += 1;
    existing.records += Number(log.totalRecords || 0);
    existing.successCount += successCount;
    existing.errorCount += errorCount;
    map.set(date, existing);
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeDailyRollupPoints(
  primary: DailyRollupPoint[],
  secondary: DailyRollupPoint[]
): DailyRollupPoint[] {
  const map = new Map<string, DailyRollupPoint>();

  for (const point of [...secondary, ...primary]) {
    const existing = map.get(point.date) ?? {
      date: point.date,
      processes: 0,
      records: 0,
      successCount: 0,
      errorCount: 0,
    };

    existing.processes += point.processes;
    existing.records += point.records;
    existing.successCount += point.successCount;
    existing.errorCount += point.errorCount;
    map.set(point.date, existing);
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function getModuleIconKey(routeKey: string): string {
  const key = routeKey.toLowerCase();
  if (key.includes('verificadorjson') || key === 'verificadorjson') return 'verificadorjson';
  if (key.includes('verificarodyfecha') || key === 'verificarodyfecha') return 'verificarodyfecha';
  if (key === 'verificador_qr' || key.includes('verificador_qr')) return 'verificador_qr';
  if (key.includes('verificador') || key === 'verificador') return 'verificador';
  if (key.includes('qr')) return 'qr-pdf';
  return key || 'activity';
}

export function computeErrorRate(
  successCount: number,
  errorCount: number
): DashboardErrorRate {
  const total = successCount + errorCount;
  if (total === 0) {
    return { errorRate: 0, successCount: 0, errorCount: 0 };
  }

  return {
    errorRate: Math.round((errorCount / total) * 100),
    successCount,
    errorCount,
  };
}

export function computeErrorRateFromPoints(
  points: ActivityPeriodPoint[]
): DashboardErrorRate {
  let successCount = 0;
  let errorCount = 0;

  for (const point of points) {
    successCount += point.successCount;
    errorCount += point.errorCount;
  }

  return computeErrorRate(successCount, errorCount);
}

export function buildErrorRates(daily: DailyRollupPoint[]): DashboardErrorRates {
  const todayKey = getDateKeyInTimezone(new Date());
  const weekStart = getWeekStartKey(todayKey);
  const monthKey = getMonthKey(todayKey);
  const yearKey = todayKey.slice(0, 4);

  let weeklySuccess = 0;
  let weeklyError = 0;
  let monthlySuccess = 0;
  let monthlyError = 0;
  let yearlySuccess = 0;
  let yearlyError = 0;

  for (const point of daily) {
    if (point.date >= weekStart && point.date <= todayKey) {
      weeklySuccess += point.successCount;
      weeklyError += point.errorCount;
    }

    if (getMonthKey(point.date) === monthKey) {
      monthlySuccess += point.successCount;
      monthlyError += point.errorCount;
    }

    if (point.date.startsWith(yearKey)) {
      yearlySuccess += point.successCount;
      yearlyError += point.errorCount;
    }
  }

  return {
    weekly: computeErrorRate(weeklySuccess, weeklyError),
    monthly: computeErrorRate(monthlySuccess, monthlyError),
    yearly: computeErrorRate(yearlySuccess, yearlyError),
  };
}
