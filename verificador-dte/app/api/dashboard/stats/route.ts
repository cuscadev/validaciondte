import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { countUsersByStatus } from '@/lib/dashboard-user-stats';
import { getOrganization, listCollaborators } from '@/lib/organization-admin';
import { canManageOrgUsers, type OrgRole, type UserRole } from '@/lib/firestoreUser';
import type { AuthUser } from '@/lib/server-auth';
import { getRouteLabel, resolveAllowedRoutes } from '@/lib/plan-access';
import {
  getMonthlyRouteUsage,
  resolveEffectiveRenewalConfig,
  resolveEffectiveUsageLimit,
} from '@/lib/usage-limits';
import type {
  DailyRollupPoint,
  DashboardModuleStat,
  DashboardRecentLog,
  DashboardStatsResponse,
  DashboardUserStats,
} from '@/lib/dashboard-stats';
import {
  aggregateDailyToMonthly,
  aggregateDailyToDailyChart,
  aggregateDailyToWeekly,
  aggregateLogsToDailyPoints,
  buildErrorRates,
  DASHBOARD_CHART_LOOKBACK_DAYS,
  getRollupStartDateKey,
} from '@/lib/dashboard-stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERIOD_DAYS = 30;
const CHART_PERIOD_DAYS = DASHBOARD_CHART_LOOKBACK_DAYS;
const CHART_LOG_LIMIT = 1000;
const LOG_LIMIT = 300;
const FETCH_LIMIT = LOG_LIMIT * 3;

function serializeDate(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;

    if (typeof record.toDate === 'function') {
      return (record.toDate as () => Date)().toISOString();
    }

    if (typeof record.toISOString === 'function') {
      return (record.toISOString as () => string)();
    }
  }

  return null;
}

function getPeriodStartDaysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

type RawLog = {
  id: string;
  routeKey: string;
  moduleName: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  outcome: 'success' | 'partial' | 'error';
  createdAt: string | null;
};

function docToRawLog(doc: FirebaseFirestore.QueryDocumentSnapshot): RawLog {
  const data = doc.data();
  return {
    id: doc.id,
    routeKey: String(data.routeKey || ''),
    moduleName: String(data.moduleName || data.routeKey || 'Proceso'),
    totalRecords: Number(data.totalRecords || 0),
    successCount: Number(data.successCount || 0),
    errorCount: Number(data.errorCount || 0),
    outcome: (data.outcome as RawLog['outcome']) || 'success',
    createdAt: serializeDate(data.createdAt),
  };
}

function isWithinPeriod(createdAt: string | null, periodStart: Date) {
  if (!createdAt) return true;
  return new Date(createdAt).getTime() >= periodStart.getTime();
}

function sortLogsByCreatedDesc(logs: RawLog[]) {
  return [...logs].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

async function fetchLogsByEquality(
  field: 'uid' | 'email' | 'cliente',
  value: string,
  periodStart: Date,
  byId: Map<string, RawLog>
) {
  const snap = await adminDb
    .collection('processingLogs')
    .where(field, '==', value)
    .limit(FETCH_LIMIT)
    .get();

  const candidates = sortLogsByCreatedDesc(
    snap.docs.map((doc) => docToRawLog(doc)).filter((log) => isWithinPeriod(log.createdAt, periodStart))
  );

  for (const log of candidates) {
    if (byId.has(log.id)) continue;
    byId.set(log.id, log);
  }
}

async function fetchLogsSafely(
  field: 'uid' | 'email' | 'cliente',
  value: string,
  periodStart: Date,
  byId: Map<string, RawLog>
) {
  if (!value) return;
  await fetchLogsByEquality(field, value, periodStart, byId);
}

async function fetchProcessingLogs(
  uid: string,
  email: string,
  cliente: string,
  periodStart: Date,
  limit = LOG_LIMIT
): Promise<RawLog[]> {
  const byId = new Map<string, RawLog>();

  await fetchLogsSafely('email', email, periodStart, byId);
  await fetchLogsSafely('uid', uid, periodStart, byId);
  await fetchLogsSafely('cliente', cliente, periodStart, byId);

  return sortLogsByCreatedDesc(Array.from(byId.values())).slice(0, limit);
}

async function fetchUserRollupDays(uid: string): Promise<DailyRollupPoint[]> {
  const startDateKey = getRollupStartDateKey();

  const snap = await adminDb
    .collection('userProcessingStats')
    .doc(uid)
    .collection('days')
    .limit(FETCH_LIMIT)
    .get();

  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        date: String(data.date || doc.id),
        processes: Number(data.processes || 0),
        records: Number(data.records || 0),
        successCount: Number(data.successCount || 0),
        errorCount: Number(data.errorCount || 0),
      };
    })
    .filter((point) => point.date >= startDateKey)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateLogs(logs: RawLog[]): Pick<
  DashboardStatsResponse,
  'totals' | 'byModule' | 'recent'
> {
  const moduleMap = new Map<string, DashboardModuleStat>();

  let processes = 0;
  let records = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const log of logs) {
    processes += 1;
    records += log.totalRecords;
    successCount += log.successCount;
    errorCount += log.errorCount;

    const moduleKey = log.routeKey || log.moduleName;
    const existing = moduleMap.get(moduleKey);
    if (existing) {
      existing.count += 1;
      existing.records += log.totalRecords;
      existing.successCount += log.successCount;
      existing.errorCount += log.errorCount;
    } else {
      moduleMap.set(moduleKey, {
        routeKey: log.routeKey,
        moduleName: log.moduleName,
        count: 1,
        records: log.totalRecords,
        successCount: log.successCount,
        errorCount: log.errorCount,
      });
    }
  }

  const totalOutcomes = successCount + errorCount;
  const successRate =
    totalOutcomes > 0 ? Math.round((successCount / totalOutcomes) * 100) : 0;

  const byModule = Array.from(moduleMap.values()).sort(
    (a, b) => b.count - a.count
  );

  const sortedLogs = sortLogsByCreatedDesc(logs);
  const recent: DashboardRecentLog[] = sortedLogs.slice(0, 5).map((log) => ({
    id: log.id,
    moduleName: log.moduleName,
    routeKey: log.routeKey,
    outcome: log.outcome,
    totalRecords: log.totalRecords,
    successCount: log.successCount,
    errorCount: log.errorCount,
    createdAt: log.createdAt,
  }));

  return {
    totals: {
      processes,
      records,
      successCount,
      errorCount,
      successRate,
    },
    byModule,
    recent,
  };
}

async function buildAllowedModuleStats(
  authUser: AuthUser,
  byModule: DashboardModuleStat[]
): Promise<DashboardModuleStat[]> {
  const [allowedRoutes, renewal] = await Promise.all([
    resolveAllowedRoutes(authUser),
    resolveEffectiveRenewalConfig(authUser),
  ]);

  const statsByRoute = new Map<string, DashboardModuleStat>();
  for (const mod of byModule) {
    const key = mod.routeKey || mod.moduleName;
    if (key && !statsByRoute.has(key)) {
      statsByRoute.set(key, mod);
    }
  }

  const enriched = await Promise.all(
    allowedRoutes.map(async (routeKey) => {
      const existing = statsByRoute.get(routeKey);
      const [limit, monthlyUsed] = await Promise.all([
        resolveEffectiveUsageLimit(authUser, routeKey),
        getMonthlyRouteUsage(
          authUser.uid,
          routeKey,
          new Date(),
          renewal.resetDayOfMonth,
          renewal.automaticReset,
          renewal.renewalDate
        ),
      ]);

      if (existing) {
        return { ...existing, limit, monthlyUsed };
      }

      return {
        routeKey,
        moduleName: getRouteLabel(routeKey),
        count: 0,
        records: 0,
        successCount: 0,
        errorCount: 0,
        limit,
        monthlyUsed,
      };
    })
  );

  return enriched.sort((a, b) => b.records - a.records);
}

function buildActivitySeries(
  rollupDaily: DailyRollupPoint[],
  chartLogs: RawLog[]
) {
  const fromLogs = aggregateLogsToDailyPoints(chartLogs);
  const hasLogActivity = fromLogs.some(
    (point) => point.successCount > 0 || point.errorCount > 0
  );
  const hasRollupActivity = rollupDaily.some(
    (point) => point.successCount > 0 || point.errorCount > 0
  );

  const daily = hasLogActivity ? fromLogs : rollupDaily;

  return {
    daily: aggregateDailyToDailyChart(daily),
    weekly: aggregateDailyToWeekly(daily),
    monthly: aggregateDailyToMonthly(daily),
    errorRates: buildErrorRates(daily),
    activitySource: hasLogActivity
      ? ('logs' as const)
      : hasRollupActivity
        ? ('rollup' as const)
        : ('logs' as const),
  };
}

async function fetchUserStats(
  appUser: Record<string, unknown>
): Promise<DashboardUserStats | null> {
  const role = String(appUser.role || '') as UserRole;
  const organizationId = String(appUser.organizationId || '');
  const orgRole = appUser.orgRole as OrgRole | undefined;

  if (role === 'superadmin') {
    const snap = await adminDb.collection('users').get();
    const counts = countUsersByStatus(snap.docs.map((doc) => doc.data()));

    return {
      ...counts,
      scope: 'platform',
      label: 'Titulares, delegados y administradores',
    };
  }

  if (!canManageOrgUsers({ role, orgRole }) || !organizationId) {
    return null;
  }

  const org = await getOrganization(organizationId);
  if (!org) return null;

  const collaborators = await listCollaborators(organizationId);
  const ownerSnap = await adminDb.collection('users').doc(org.ownerUid).get();
  const members = [
    ...(ownerSnap.exists ? [ownerSnap.data()!] : []),
    ...collaborators,
  ];
  const counts = countUsersByStatus(
    members.map((member) => {
      const record = member as Record<string, unknown>;
      return {
        accountStatus:
          typeof record.accountStatus === 'string' ? record.accountStatus : undefined,
        disabled: record.disabled === true,
      };
    })
  );

  return {
    ...counts,
    scope: 'organization',
    label: 'Titular y delegados de tu organizacion',
  };
}

async function fetchMobileStats(uid: string) {
  const snap = await adminDb
    .collection('mobileScanBatches')
    .where('uid', '==', uid)
    .get();

  let pendingBatches = 0;
  let totalScans = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const status = String(data.status || 'pending');
    if (status === 'pending') pendingBatches += 1;
    totalScans += Number(data.count || data.scans?.length || 0);
  }

  return { pendingBatches, totalScans };
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const appUser = userSnap.data() || {};

    const email = String(decoded.email || appUser.email || '').toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Usuario sin email' }, { status: 400 });
    }

    const role = String(appUser.role || '');
    const organizationId = String(appUser.organizationId || '');
    const cliente =
      role === 'cliente' ? String(appUser.cliente || appUser.displayName || '') : '';

    const periodStart = getPeriodStartDaysAgo(PERIOD_DAYS);
    const chartPeriodStart = getPeriodStartDaysAgo(CHART_PERIOD_DAYS);

    const [logs, chartLogs, rollupDaily, mobile, users] = await Promise.all([
      fetchProcessingLogs(decoded.uid, email, cliente, periodStart),
      fetchProcessingLogs(decoded.uid, email, cliente, chartPeriodStart, CHART_LOG_LIMIT),
      fetchUserRollupDays(decoded.uid),
      fetchMobileStats(decoded.uid),
      fetchUserStats(appUser),
    ]);

    const aggregated = aggregateLogs(logs);
    const authUser: AuthUser = {
      ...(appUser as Omit<AuthUser, 'uid' | 'email'>),
      uid: decoded.uid,
      email,
    };
    const byModule = await buildAllowedModuleStats(authUser, aggregated.byModule);
    const activity = buildActivitySeries(rollupDaily, chartLogs);

    const response: DashboardStatsResponse = {
      period: {
        from: periodStart.toISOString(),
        to: new Date().toISOString(),
      },
      totals: aggregated.totals,
      byModule,
      recent: aggregated.recent,
      daily: activity.daily,
      weekly: activity.weekly,
      monthly: activity.monthly,
      errorRates: activity.errorRates,
      activitySource: activity.activitySource,
      mobile,
      users,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error interno',
      },
      { status: 500 }
    );
  }
}
