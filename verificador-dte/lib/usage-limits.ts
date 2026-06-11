import { adminDb } from '@/lib/firebase-admin';
import type { AuthUser } from '@/lib/server-auth';
import type { MembershipType } from '@/lib/firestoreUser';
import { getOrganization } from '@/lib/organization-admin';

export type UsageLimitValue = number | null;

export type UsageLimits = {
  routeLimits?: Record<string, UsageLimitValue>;
  batchLimits?: Record<string, UsageLimitValue>;
  mobileScanFolderLimit?: UsageLimitValue;
  resetDayOfMonth?: number;
  renewalDate?: string;
  automaticReset?: boolean;
};

export type UsageAdjustmentAction = 'increment' | 'decrement' | 'set';

type PlanLimitConfig = {
  queryLimit?: UsageLimitValue;
  mobileScanFolderLimit?: UsageLimitValue;
  routeLimits?: Record<string, UsageLimitValue>;
  batchLimits?: Record<string, UsageLimitValue>;
  resetDayOfMonth?: number;
  renewalDate?: string;
  automaticReset?: boolean;
};

function cleanLimit(value: unknown): UsageLimitValue | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value > 0 ? Math.floor(value) : undefined;
}

function cleanResetDay(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(31, Math.max(1, Math.floor(value)));
}

function cleanRenewalDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  const date = new Date(`${trimmed}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : trimmed;
}

function renewalDateToResetDay(value: unknown): number | undefined {
  const clean = cleanRenewalDate(value);
  if (!clean) return undefined;
  return cleanResetDay(Number(clean.slice(8, 10)));
}

function getBatchRouteLimit(limits: unknown, routeKey: string): UsageLimitValue | undefined {
  const data = limits as UsageLimits | undefined;
  return cleanLimit(data?.batchLimits?.[routeKey]);
}

function getRouteLimit(limits: unknown, routeKey: string): UsageLimitValue | undefined {
  const data = limits as UsageLimits | undefined;
  const routeValue = data?.routeLimits?.[routeKey];
  const normalized = cleanLimit(routeValue);
  if (normalized !== undefined) return normalized;

  if (routeKey === 'escaneos-mobile') {
    return cleanLimit(data?.mobileScanFolderLimit);
  }

  return undefined;
}

export function sanitizeUsageLimits(raw: unknown): UsageLimits {
  const input = (raw || {}) as UsageLimits;
  const routeLimits: Record<string, UsageLimitValue> = {};
  const batchLimits: Record<string, UsageLimitValue> = {};

  for (const [routeKey, value] of Object.entries(input.routeLimits || {})) {
    const cleanKey = routeKey.trim();
    const clean = cleanLimit(value);
    if (cleanKey && clean !== undefined) {
      routeLimits[cleanKey] = clean;
    }
  }

  for (const [routeKey, value] of Object.entries(input.batchLimits || {})) {
    const cleanKey = routeKey.trim();
    const clean = cleanLimit(value);
    if (cleanKey && clean !== undefined) {
      batchLimits[cleanKey] = clean;
    }
  }

  const output: UsageLimits = {};
  if (Object.keys(routeLimits).length > 0) {
    output.routeLimits = routeLimits;
  }
  if (Object.keys(batchLimits).length > 0) {
    output.batchLimits = batchLimits;
  }

  const mobileLimit = cleanLimit(input.mobileScanFolderLimit);
  if (mobileLimit !== undefined) {
    output.mobileScanFolderLimit = mobileLimit;
  }

  const resetDayOfMonth = cleanResetDay(input.resetDayOfMonth);
  if (resetDayOfMonth !== undefined) {
    output.resetDayOfMonth = resetDayOfMonth;
  }

  const renewalDate = cleanRenewalDate(input.renewalDate);
  if (renewalDate !== undefined) {
    output.renewalDate = renewalDate;
    output.resetDayOfMonth = renewalDateToResetDay(renewalDate);
  }

  if (typeof input.automaticReset === 'boolean') {
    output.automaticReset = input.automaticReset;
  }

  return output;
}

async function getPlanConfig(membershipType: MembershipType): Promise<PlanLimitConfig> {
  const snap = await adminDb.doc('config/plans').get();
  const plans = snap.data() as Record<string, PlanLimitConfig> | undefined;
  return plans?.[membershipType] || {};
}

export async function resolveEffectiveUsageLimit(
  user: AuthUser,
  routeKey: string
): Promise<UsageLimitValue> {
  if (user.role === 'superadmin') return null;

  const userLimit = getRouteLimit(user.limits, routeKey);
  if (userLimit !== undefined) return userLimit;

  const organizationId = user.organizationId || (user.role === 'cliente' ? user.uid : '');
  if (organizationId) {
    const org = await getOrganization(organizationId);
    const orgLimit = getRouteLimit(org?.limits, routeKey);
    if (orgLimit !== undefined) return orgLimit;
  }

  const membershipType = (user.membership?.type || 'free') as MembershipType;
  const plan = await getPlanConfig(membershipType);
  const planRouteLimit = cleanLimit(plan.routeLimits?.[routeKey]);
  if (planRouteLimit !== undefined) return planRouteLimit;

  if (routeKey === 'escaneos-mobile') {
    const mobileLimit = cleanLimit(plan.mobileScanFolderLimit);
    if (mobileLimit !== undefined) return mobileLimit;
  }

  const queryLimit = cleanLimit(plan.queryLimit);
  return queryLimit !== undefined ? queryLimit : null;
}

export async function resolveEffectiveBatchLimit(
  user: AuthUser,
  routeKey: string
): Promise<UsageLimitValue> {
  if (user.role === 'superadmin') return null;

  const userLimit = getBatchRouteLimit(user.limits, routeKey);
  if (userLimit !== undefined) return userLimit;

  const organizationId = user.organizationId || (user.role === 'cliente' ? user.uid : '');
  if (organizationId) {
    const org = await getOrganization(organizationId);
    const orgLimit = getBatchRouteLimit(org?.limits, routeKey);
    if (orgLimit !== undefined) return orgLimit;
  }

  const membershipType = (user.membership?.type || 'free') as MembershipType;
  const plan = await getPlanConfig(membershipType);
  const planBatchLimit = cleanLimit(plan.batchLimits?.[routeKey]);
  if (planBatchLimit !== undefined) return planBatchLimit;

  return null;
}

export function batchLimitUnit(routeKey: string): string {
  if (routeKey === 'verificadorjson' || routeKey === 'consultas_lotes_json') {
    return 'archivos';
  }
  if (
    routeKey === 'verificador' ||
    routeKey === 'verificarodyfecha' ||
    routeKey === 'verificacion_individual' ||
    routeKey === 'verificador_qr'
  ) {
    return 'links';
  }
  return 'registros';
}

export async function assertBatchProcessLimit(
  user: AuthUser,
  routeKey: string,
  incomingRecords: number
) {
  const limit = await resolveEffectiveBatchLimit(user, routeKey);
  if (limit === null) return { limit, allowed: true };

  const count = Math.max(0, incomingRecords);
  if (count > limit) {
    throw new Error(
      `Limite por proceso alcanzado: maximo ${limit} ${batchLimitUnit(routeKey)} por ejecucion (intentaste ${count}).`
    );
  }

  return { limit, allowed: true };
}

export async function resolveEffectiveResetDay(user: AuthUser): Promise<number> {
  const userResetDay = renewalDateToResetDay(user.limits?.renewalDate) ?? cleanResetDay(user.limits?.resetDayOfMonth);
  if (userResetDay !== undefined) return userResetDay;

  const organizationId = user.organizationId || (user.role === 'cliente' ? user.uid : '');
  if (organizationId) {
    const org = await getOrganization(organizationId);
    const orgResetDay = renewalDateToResetDay(org?.limits?.renewalDate) ?? cleanResetDay(org?.limits?.resetDayOfMonth);
    if (orgResetDay !== undefined) return orgResetDay;
  }

  const membershipType = (user.membership?.type || 'free') as MembershipType;
  const plan = await getPlanConfig(membershipType);
  return renewalDateToResetDay(plan.renewalDate) ?? cleanResetDay(plan.resetDayOfMonth) ?? 1;
}

export async function resolveEffectiveRenewalConfig(user: AuthUser) {
  if (user.limits?.renewalDate || typeof user.limits?.automaticReset === 'boolean') {
    return {
      renewalDate: cleanRenewalDate(user.limits.renewalDate),
      automaticReset: user.limits.automaticReset ?? true,
      resetDayOfMonth: renewalDateToResetDay(user.limits.renewalDate) ?? cleanResetDay(user.limits.resetDayOfMonth) ?? 1,
    };
  }

  const organizationId = user.organizationId || (user.role === 'cliente' ? user.uid : '');
  if (organizationId) {
    const org = await getOrganization(organizationId);
    if (org?.limits?.renewalDate || typeof org?.limits?.automaticReset === 'boolean') {
      return {
        renewalDate: cleanRenewalDate(org.limits.renewalDate),
        automaticReset: org.limits.automaticReset ?? true,
        resetDayOfMonth: renewalDateToResetDay(org.limits.renewalDate) ?? cleanResetDay(org.limits.resetDayOfMonth) ?? 1,
      };
    }
  }

  const membershipType = (user.membership?.type || 'free') as MembershipType;
  const plan = await getPlanConfig(membershipType);
  return {
    renewalDate: cleanRenewalDate(plan.renewalDate),
    automaticReset: plan.automaticReset ?? true,
    resetDayOfMonth: renewalDateToResetDay(plan.renewalDate) ?? cleanResetDay(plan.resetDayOfMonth) ?? 1,
  };
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function cycleDate(year: number, monthIndex: number, resetDayOfMonth: number) {
  return new Date(year, monthIndex, Math.min(resetDayOfMonth, daysInMonth(year, monthIndex)));
}

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function getUsagePeriodStart(
  date = new Date(),
  resetDayOfMonth = 1,
  automaticReset = true,
  renewalDate?: string
) {
  const cleanRenewal = cleanRenewalDate(renewalDate);
  if (!automaticReset && cleanRenewal) {
    return parseLocalDate(cleanRenewal);
  }

  const resetDay = cleanResetDay(resetDayOfMonth) ?? 1;
  const currentStart = cycleDate(date.getFullYear(), date.getMonth(), resetDay);
  if (date.getTime() >= currentStart.getTime()) return currentStart;
  return cycleDate(date.getFullYear(), date.getMonth() - 1, resetDay);
}

export function getUsagePeriodKey(
  date = new Date(),
  resetDayOfMonth = 1,
  automaticReset = true,
  renewalDate?: string
) {
  const start = getUsagePeriodStart(date, resetDayOfMonth, automaticReset, renewalDate);
  return [
    start.getFullYear(),
    String(start.getMonth() + 1).padStart(2, '0'),
    String(start.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getUsageMonthKey(date = new Date(), resetDayOfMonth = 1) {
  return getUsagePeriodKey(date, resetDayOfMonth);
}

export function getUsageCounterId(uid: string, routeKey: string, monthKey = getUsagePeriodKey()) {
  return `${uid}_${routeKey}_${monthKey}`.replace(/[\/#?[\]]/g, '_');
}

export async function getMonthlyRouteUsageFromLogs(
  uid: string,
  routeKey: string,
  date = new Date(),
  resetDayOfMonth = 1,
  automaticReset = true,
  renewalDate?: string
) {
  const start = getUsagePeriodStart(date, resetDayOfMonth, automaticReset, renewalDate);
  const snap = await adminDb
    .collection('processingLogs')
    .where('uid', '==', uid)
    .get();

  return snap.docs.reduce((total, doc) => {
    const data = doc.data();
    if (String(data.routeKey || '') !== routeKey) return total;
    const createdAt = data.createdAt;
    const createdDate =
      createdAt instanceof Date
        ? createdAt
        : createdAt && typeof createdAt === 'object' && 'toDate' in createdAt
          ? (createdAt as { toDate?: () => Date }).toDate?.()
          : null;
    if (!createdDate || createdDate < start) return total;
    return total + Number(data.totalRecords || 0);
  }, 0);
}

export async function getUsageAdjustment(uid: string, routeKey: string, monthKey = getUsagePeriodKey()) {
  const snap = await adminDb.collection('usageCounters').doc(getUsageCounterId(uid, routeKey, monthKey)).get();
  return Number(snap.data()?.adjustment || 0);
}

export async function getMonthlyRouteUsage(
  uid: string,
  routeKey: string,
  date = new Date(),
  resetDayOfMonth = 1,
  automaticReset = true,
  renewalDate?: string
) {
  const monthKey = getUsagePeriodKey(date, resetDayOfMonth, automaticReset, renewalDate);
  const [fromLogs, adjustment] = await Promise.all([
    getMonthlyRouteUsageFromLogs(uid, routeKey, date, resetDayOfMonth, automaticReset, renewalDate),
    getUsageAdjustment(uid, routeKey, monthKey),
  ]);

  return Math.max(0, fromLogs + adjustment);
}

export async function adjustMonthlyRouteUsage({
  uid,
  routeKey,
  action,
  amount,
  resetDayOfMonth = 1,
  automaticReset = true,
  renewalDate,
  monthKey = getUsagePeriodKey(new Date(), resetDayOfMonth, automaticReset, renewalDate),
  actorUid,
}: {
  uid: string;
  routeKey: string;
  action: UsageAdjustmentAction;
  amount: number;
  resetDayOfMonth?: number;
  automaticReset?: boolean;
  renewalDate?: string;
  monthKey?: string;
  actorUid: string;
}) {
  const cleanAmount = Math.max(0, Math.floor(Number(amount) || 0));
  const fromLogs = await getMonthlyRouteUsageFromLogs(uid, routeKey, new Date(), resetDayOfMonth, automaticReset, renewalDate);
  const currentAdjustment = await getUsageAdjustment(uid, routeKey, monthKey);
  const currentUsed = Math.max(0, fromLogs + currentAdjustment);
  const nextUsed =
    action === 'set'
      ? cleanAmount
      : action === 'increment'
        ? currentUsed + cleanAmount
        : Math.max(0, currentUsed - cleanAmount);
  const nextAdjustment = nextUsed - fromLogs;
  const ref = adminDb.collection('usageCounters').doc(getUsageCounterId(uid, routeKey, monthKey));

  await ref.set(
    {
      uid,
      routeKey,
      monthKey,
      resetDayOfMonth,
      automaticReset,
      renewalDate: cleanRenewalDate(renewalDate) || null,
      adjustment: nextAdjustment,
      usedOverride: nextUsed,
      fromLogs,
      updatedAt: new Date(),
      updatedBy: actorUid,
    },
    { merge: true }
  );

  await ref.collection('history').add({
    action,
    amount: cleanAmount,
    previousUsed: currentUsed,
    nextUsed,
    previousAdjustment: currentAdjustment,
    nextAdjustment,
    fromLogs,
    createdAt: new Date(),
    createdBy: actorUid,
  });

  return { used: nextUsed, fromLogs, adjustment: nextAdjustment, monthKey };
}

export async function assertMonthlyUsageLimit(
  user: AuthUser,
  routeKey: string,
  incomingRecords: number
) {
  const limit = await resolveEffectiveUsageLimit(user, routeKey);
  if (limit === null) return { limit, used: 0, remaining: null };

  const renewal = await resolveEffectiveRenewalConfig(user);
  const used = await getMonthlyRouteUsage(
    user.uid,
    routeKey,
    new Date(),
    renewal.resetDayOfMonth,
    renewal.automaticReset,
    renewal.renewalDate
  );
  const nextTotal = used + Math.max(0, incomingRecords);
  if (nextTotal > limit) {
    throw new Error(
      `Limite mensual alcanzado para este modulo: ${used}/${limit} usados, ${incomingRecords} nuevos.`
    );
  }

  return { limit, used, remaining: Math.max(0, limit - nextTotal), ...renewal };
}
