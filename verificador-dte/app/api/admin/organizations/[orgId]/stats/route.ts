import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getOrganization, listCollaborators } from '@/lib/organization-admin';
import { buildOrganizationDisplay } from '@/lib/org-display';
import { requireSuperadmin } from '@/lib/server-auth';
import type {
  DashboardModuleStat,
  DashboardRecentLog,
  DashboardStatsTotals,
} from '@/lib/dashboard-stats';
import { normalizeLogOutcomeCounts } from '@/lib/dashboard-stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERIOD_DAYS = 30;
const LOG_LIMIT_PER_MEMBER = 500;
const FALLBACK_FETCH_LIMIT = 1200;

type RawLog = {
  id: string;
  uid: string;
  routeKey: string;
  moduleName: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  outcome: 'success' | 'partial' | 'error';
  createdAt: string | null;
};

type MemberRow = {
  uid: string;
  email: string;
  displayName: string;
  role: 'cliente' | 'colaborador';
  orgRole?: string;
};

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

function getPeriodStart() {
  return new Date(Date.now() - PERIOD_DAYS * 86_400_000);
}

function docToRawLog(doc: FirebaseFirestore.QueryDocumentSnapshot): RawLog {
  const data = doc.data();
  const outcome =
    data.outcome === 'partial' || data.outcome === 'error' ? data.outcome : 'success';

  return {
    id: doc.id,
    uid: String(data.uid || ''),
    routeKey: String(data.routeKey || ''),
    moduleName: String(data.moduleName || data.routeKey || 'Proceso'),
    totalRecords: Number(data.totalRecords || 0),
    successCount: Number(data.successCount || 0),
    errorCount: Number(data.errorCount || 0),
    outcome,
    createdAt: serializeDate(data.createdAt),
  };
}

function isWithinPeriod(log: RawLog, periodStart: Date) {
  if (!log.createdAt) return true;
  return new Date(log.createdAt).getTime() >= periodStart.getTime();
}

function sortLogs(logs: RawLog[]) {
  return [...logs].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

async function fetchMemberLogs(uid: string, periodStart: Date): Promise<RawLog[]> {
  const snap = await adminDb
    .collection('processingLogs')
    .where('uid', '==', uid)
    .limit(FALLBACK_FETCH_LIMIT)
    .get();

  return sortLogs(
    snap.docs.map((doc) => docToRawLog(doc)).filter((log) => isWithinPeriod(log, periodStart))
  ).slice(0, LOG_LIMIT_PER_MEMBER);
}

function aggregateLogs(logs: RawLog[]): {
  totals: DashboardStatsTotals;
  byModule: DashboardModuleStat[];
  recent: DashboardRecentLog[];
} {
  const moduleMap = new Map<string, DashboardModuleStat>();
  let processes = 0;
  let records = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const log of logs) {
    const normalized = normalizeLogOutcomeCounts(log);
    processes += 1;
    records += log.totalRecords;
    successCount += normalized.successCount;
    errorCount += normalized.errorCount;

    const moduleKey = log.routeKey || log.moduleName;
    const existing = moduleMap.get(moduleKey);
    if (existing) {
      existing.count += 1;
      existing.records += log.totalRecords;
      existing.successCount += normalized.successCount;
      existing.errorCount += normalized.errorCount;
    } else {
      moduleMap.set(moduleKey, {
        routeKey: log.routeKey,
        moduleName: log.moduleName,
        count: 1,
        records: log.totalRecords,
        successCount: normalized.successCount,
        errorCount: normalized.errorCount,
      });
    }
  }

  const totalOutcomes = successCount + errorCount;
  const successRate =
    totalOutcomes > 0 ? Math.round((successCount / totalOutcomes) * 100) : 0;

  return {
    totals: {
      processes,
      records,
      successCount,
      errorCount,
      successRate,
    },
    byModule: Array.from(moduleMap.values()).sort((a, b) => b.records - a.records),
    recent: sortLogs(logs).slice(0, 6).map((log) => ({
      id: log.id,
      moduleName: log.moduleName,
      routeKey: log.routeKey,
      outcome: log.outcome,
      totalRecords: log.totalRecords,
      successCount: log.successCount,
      errorCount: log.errorCount,
      createdAt: log.createdAt,
    })),
  };
}

function mapMember(uid: string, data: Record<string, unknown>, role: MemberRow['role']): MemberRow {
  return {
    uid,
    email: String(data.email || ''),
    displayName: String(data.displayName || data.cliente || data.email || ''),
    role,
    orgRole: typeof data.orgRole === 'string' ? data.orgRole : undefined,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireSuperadmin(req);
    const { orgId } = await params;
    const org = await getOrganization(orgId);

    if (!org) {
      return NextResponse.json({ error: 'Organizacion no encontrada' }, { status: 404 });
    }

    const [ownerSnap, collaborators] = await Promise.all([
      adminDb.collection('users').doc(org.ownerUid).get(),
      listCollaborators(orgId),
    ]);

    const ownerData = ownerSnap.data() ?? {};
    const members: MemberRow[] = [
      ...(ownerSnap.exists ? [mapMember(ownerSnap.id, ownerData, 'cliente')] : []),
      ...collaborators.map((collaborator) => {
        const row = collaborator as Record<string, unknown> & { uid: string };
        return mapMember(row.uid, row, 'colaborador');
      }),
    ];

    const periodStart = getPeriodStart();
    const memberLogs = await Promise.all(
      members.map(async (member) => {
        const logs = await fetchMemberLogs(member.uid, periodStart);
        return { member, logs };
      })
    );
    const memberStats = memberLogs.map(({ member, logs }) => ({
          ...member,
          ...aggregateLogs(logs),
    }));
    const allLogs = memberLogs.flatMap((item) => item.logs);
    const orgStats = aggregateLogs(allLogs);

    return NextResponse.json({
      period: {
        from: periodStart.toISOString(),
        to: new Date().toISOString(),
      },
      organization: {
        id: orgId,
        name: org.name,
        ...buildOrganizationDisplay(org),
        collaboratorCount: org.collaboratorCount,
        maxCollaborators: org.maxCollaborators,
        membershipType: org.membershipType,
        status: org.status,
      },
      totals: orgStats.totals,
      byModule: orgStats.byModule,
      recent: orgStats.recent,
      members: memberStats.sort((a, b) => {
        if (a.role !== b.role) return a.role === 'cliente' ? -1 : 1;
        return b.totals.records - a.totals.records;
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 500 }
    );
  }
}
