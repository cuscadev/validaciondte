import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { incrementUserProcessingStats } from '@/lib/processing-stats-rollup';
import type {
  ProcessingFileSummary,
  ProcessingLogPayload,
} from '@/lib/processing-log';

type ProcessingLogIdentity = {
  uid: string;
  email?: string;
  role?: string;
  cliente?: string;
};

type ServerProcessingLogPayload = ProcessingLogPayload & {
  source?: string;
  userAgent?: string;
  deviceName?: string;
  licenseKey?: string;
  deviceId?: string;
};

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || '';
  }

  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-client-ip') ||
    ''
  );
}

function describeDevice(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const os = ua.includes('windows')
    ? 'Windows'
    : ua.includes('android')
      ? 'Android'
      : ua.includes('iphone') || ua.includes('ipad')
        ? 'iOS'
        : ua.includes('mac os')
          ? 'macOS'
          : ua.includes('linux')
            ? 'Linux'
            : 'Desconocido';

  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('chrome/')
      ? 'Chrome'
      : ua.includes('firefox/')
        ? 'Firefox'
        : ua.includes('safari/')
          ? 'Safari'
          : 'Navegador';

  return `${browser} en ${os}`;
}

async function getClientEmail(cliente: unknown) {
  const value = String(cliente || '').trim();
  if (!value) return '';
  if (value.includes('@')) return value.toLowerCase();

  const byUid = await adminDb.collection('users').doc(value).get();
  if (byUid.exists) {
    return String(byUid.data()?.email || '').toLowerCase();
  }

  const byDisplayName = await adminDb
    .collection('users')
    .where('displayName', '==', value)
    .limit(1)
    .get();

  return byDisplayName.empty
    ? ''
    : String(byDisplayName.docs[0].data().email || '').toLowerCase();
}

function normalizeFiles(files: ProcessingFileSummary | undefined) {
  return {
    count: Number(files?.count || 0),
    totalBytes: Number(files?.totalBytes || 0),
    extensions: Array.isArray(files?.extensions) ? files.extensions : [],
    mimeTypes: Array.isArray(files?.mimeTypes) ? files.mimeTypes : [],
  };
}

export async function recordServerProcessingLog(
  req: NextRequest,
  identity: ProcessingLogIdentity,
  payload: ServerProcessingLogPayload
) {
  const userSnap = await adminDb.collection('users').doc(identity.uid).get();
  const appUser = userSnap.data() || {};
  const email = String(identity.email || appUser.email || '').toLowerCase();
  const cliente = identity.cliente || appUser.cliente || '';
  const userAgent = String(payload.userAgent || req.headers.get('user-agent') || '');
  const now = new Date();

  await adminDb.collection('processingLogs').add({
    uid: identity.uid,
    email,
    emailLower: email,
    role: identity.role || appUser.role || '',
    cliente,
    clientEmail: await getClientEmail(cliente),
    routeKey: payload.routeKey || '',
    moduleName: payload.moduleName || '',
    moduleKey: payload.routeKey || payload.moduleName || '',
    source: payload.source || 'web',
    licenseKey: payload.licenseKey || '',
    deviceId: payload.deviceId || '',
    deviceName: payload.deviceName || describeDevice(userAgent),
    ipAddress: getClientIp(req),
    startedAt: payload.startedAt ? new Date(payload.startedAt) : now,
    endedAt: payload.endedAt ? new Date(payload.endedAt) : now,
    durationMs: Number(payload.durationMs || 0),
    waitSeconds: Number(payload.durationMs || 0) / 1000,
    files: normalizeFiles(payload.files),
    totalRecords: Number(payload.totalRecords || 0),
    successCount: Number(payload.successCount || 0),
    errorCount: Number(payload.errorCount || 0),
    statusBreakdown: payload.statusBreakdown || {},
    outcome: payload.outcome || 'success',
    errorMessage: payload.errorMessage || '',
    userAgent,
    createdAt: now,
  });

  await incrementUserProcessingStats(
    identity.uid,
    {
      totalRecords: Number(payload.totalRecords || 0),
      successCount: Number(payload.successCount || 0),
      errorCount: Number(payload.errorCount || 0),
    },
    now
  );
}
