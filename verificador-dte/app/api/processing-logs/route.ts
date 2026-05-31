import { NextRequest, NextResponse } from 'next/server';
import { Filter } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { incrementUserProcessingStats } from '@/lib/processing-stats-rollup';
import { requireSuperadmin } from '@/lib/server-auth';

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

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(
    JSON.stringify({
      createdAt: createdAt.toISOString(),
      id,
    })
  ).toString('base64url');
}

function decodeCursor(cursor: string) {
  const decoded = JSON.parse(
    Buffer.from(cursor, 'base64url').toString('utf8')
  ) as {
    createdAt: string;
    id: string;
  };

  return {
    createdAt: new Date(decoded.createdAt),
    id: decoded.id,
  };
}

function serializeDate(value: unknown) {
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

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const appUser = userSnap.data() || {};
    const body = await req.json();
    const email = String(decoded.email || appUser.email || '').toLowerCase();
    const userAgent = String(body.userAgent || req.headers.get('user-agent') || '');
    const ipAddress = getClientIp(req);
    const clientEmail = await getClientEmail(appUser.cliente);

    await adminDb.collection('processingLogs').add({
      uid: decoded.uid,
      email,
      emailLower: email,
      role: appUser.role || '',
      cliente: appUser.cliente || '',
      clientEmail,
      routeKey: body.routeKey || '',
      moduleName: body.moduleName || '',
      moduleKey: body.routeKey || body.moduleName || '',
      source: body.source || 'web',
      licenseKey: body.licenseKey || '',
      deviceId: body.deviceId || '',
      deviceName: body.deviceName || describeDevice(userAgent),
      ipAddress,
      startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
      endedAt: body.endedAt ? new Date(body.endedAt) : new Date(),
      durationMs: Number(body.durationMs || 0),
      waitSeconds: Number(body.durationMs || 0) / 1000,
      files: {
        count: Number(body.files?.count || 0),
        totalBytes: Number(body.files?.totalBytes || 0),
        extensions: Array.isArray(body.files?.extensions)
          ? body.files.extensions
          : [],
        mimeTypes: Array.isArray(body.files?.mimeTypes)
          ? body.files.mimeTypes
          : [],
      },
      totalRecords: Number(body.totalRecords || 0),
      successCount: Number(body.successCount || 0),
      errorCount: Number(body.errorCount || 0),
      statusBreakdown: body.statusBreakdown || {},
      outcome: body.outcome || 'success',
      errorMessage: body.errorMessage || '',
      userAgent,
      createdAt: new Date(),
    });

    await incrementUserProcessingStats(decoded.uid, {
      totalRecords: Number(body.totalRecords || 0),
      successCount: Number(body.successCount || 0),
      errorCount: Number(body.errorCount || 0),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Error guardando log',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireSuperadmin(req);

    const params = req.nextUrl.searchParams;

    const limitParam = Number(params.get('limit') || 10);
    const limit = [5, 10, 20].includes(limitParam) ? limitParam : 10;

    const cursor = params.get('cursor') || '';

    const email = (params.get('email') || '').trim().toLowerCase();
    const moduleFilter = (params.get('module') || '').trim();
    const outcome = (params.get('outcome') || '').trim();
    const from = params.get('from');
    const to = params.get('to');
    const minFiles = Number(params.get('minFiles') || 0);
    const maxFiles = Number(params.get('maxFiles') || 0);
    const minRecords = Number(params.get('minRecords') || 0);

    let query: FirebaseFirestore.Query = adminDb.collection('processingLogs');

    if (email) {
      query = query.where(
        Filter.or(
          Filter.where('email', '==', email),
          Filter.where('clientEmail', '==', email),
          Filter.where('cliente', '==', email)
        )
      );
    }

    if (moduleFilter) {
      query = query.where('routeKey', '==', moduleFilter);
    }

    if (outcome) {
      query = query.where('outcome', '==', outcome);
    }

    if (from) {
      query = query.where('createdAt', '>=', new Date(`${from}T00:00:00`));
    }

    if (to) {
      query = query.where('createdAt', '<=', new Date(`${to}T23:59:59.999`));
    }

    query = query.orderBy('createdAt', 'desc');

    if (cursor) {
      const decodedCursor = decodeCursor(cursor);
      query = query.startAfter(decodedCursor.createdAt);
    }

    const snap = await query.limit(limit + 1).get();

    type ProcessingLogDocument = Record<string, unknown>;

    let docs = snap.docs;
    const hasMoreFromFirestore = docs.length > limit;

    if (hasMoreFromFirestore) {
      docs = docs.slice(0, limit);
    }

    let logs = docs.map((doc) => {
      const data = doc.data() as ProcessingLogDocument;
      const userAgent = String(data.userAgent || '');

      return {
        id: doc.id,
        ...data,
        ipAddress: data.ipAddress || '',
        deviceName: data.deviceName || describeDevice(userAgent),
        createdAt: serializeDate(data.createdAt),
        startedAt: serializeDate(data.startedAt),
        endedAt: serializeDate(data.endedAt),
      };
    });

    logs = logs.filter((log) => {
      const record = log as Record<string, unknown>;

      const emailValue = String(record.email || '').toLowerCase();
      const clientEmailValue = String(record.clientEmail || '').toLowerCase();
      const clienteValue = String(record.cliente || '').toLowerCase();
      const routeKeyValue = String(record.routeKey || '');
      const moduleNameValue = String(record.moduleName || '');
      const outcomeValue = String(record.outcome || '');
      const ipAddressValue = String(record.ipAddress || '').toLowerCase();
      const deviceNameValue = String(record.deviceName || '').toLowerCase();

      const files = record.files as Record<string, unknown> | undefined;
      const fileCount = Number(files?.count || 0);
      const totalRecordsValue = Number(record.totalRecords || 0);

      if (
        email &&
        emailValue !== email &&
        clientEmailValue !== email &&
        clienteValue !== email
      ) {
        return false;
      }

      if (
        moduleFilter &&
        routeKeyValue !== moduleFilter &&
        moduleNameValue !== moduleFilter
      ) {
        return false;
      }

      if (outcome && outcomeValue !== outcome) return false;
      if (params.get('device') && !deviceNameValue.includes(String(params.get('device')).toLowerCase())) return false;
      if (params.get('ip') && !ipAddressValue.includes(String(params.get('ip')).toLowerCase())) return false;
      if (minFiles && fileCount < minFiles) return false;
      if (maxFiles && fileCount > maxFiles) return false;
      if (minRecords && totalRecordsValue < minRecords) return false;

      return true;
    });

    const lastDoc = docs[docs.length - 1];
    const lastData = lastDoc?.data() as ProcessingLogDocument | undefined;
    const lastCreatedAt = lastData?.createdAt as
      | FirebaseFirestore.Timestamp
      | Date
      | undefined;

    const nextCursor =
      hasMoreFromFirestore && lastDoc && lastCreatedAt
        ? encodeCursor(
            typeof (lastCreatedAt as FirebaseFirestore.Timestamp).toDate ===
              'function'
              ? (lastCreatedAt as FirebaseFirestore.Timestamp).toDate()
              : (lastCreatedAt as Date),
            lastDoc.id
          )
        : null;

    return NextResponse.json({
      logs,
      nextCursor,
      hasMore: Boolean(nextCursor),
      limit,
      totalReturned: logs.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'No autorizado',
      },
      { status: 403 }
    );
  }
}
