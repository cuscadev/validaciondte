import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/server-auth';

const VISIT_HEADER = 'kaiser-dte-landing';

function getElSalvadorDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

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

function getVisitorKey(req: NextRequest, dateKey: string) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';
  const source = `${dateKey}:${ip}:${userAgent}`;

  return createHash('sha256').update(source).digest('hex');
}

function getAllowedOrigins(req: NextRequest) {
  const configuredOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    'https://verificadordtev2.cuscadev.com',
    req.nextUrl.origin,
  ];

  return new Set(
    configuredOrigins
      .map((origin) => origin?.trim().replace(/\/$/, ''))
      .filter(Boolean)
  );
}

function isAllowedRequest(req: NextRequest) {
  const origin = req.headers.get('origin')?.replace(/\/$/, '') || '';
  const referer = req.headers.get('referer') || '';
  const fetchSite = req.headers.get('sec-fetch-site') || '';
  const visitHeader = req.headers.get('x-landing-visit') || '';
  const allowedOrigins = getAllowedOrigins(req);

  if (visitHeader !== VISIT_HEADER) return false;
  if (fetchSite === 'cross-site') return false;
  if (origin) return allowedOrigins.has(origin);

  return [...allowedOrigins].some((allowedOrigin) =>
    referer.startsWith(`${allowedOrigin}/`)
  );
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
    if (!isAllowedRequest(req)) {
      return NextResponse.json({ error: 'Solicitud no permitida' }, { status: 403 });
    }

    const dateKey = getElSalvadorDateKey();
    const visitorKey = getVisitorKey(req, dateKey);
    const visitorRef = adminDb
      .collection('landingVisitDailyVisitors')
      .doc(`${dateKey}_${visitorKey}`);
    const totalRef = adminDb.collection('landingVisitStats').doc('total');
    const dailyRef = adminDb.collection('landingVisitStats').doc(dateKey);

    await adminDb.runTransaction(async (transaction) => {
      const visitorSnap = await transaction.get(visitorRef);

      if (!visitorSnap.exists) {
        transaction.set(visitorRef, {
          date: dateKey,
          createdAt: new Date(),
        });
      }

      transaction.set(
        totalRef,
        {
          count: FieldValue.increment(1),
          uniqueCount: visitorSnap.exists ? FieldValue.increment(0) : FieldValue.increment(1),
          updatedAt: new Date(),
        },
        { merge: true }
      );

      transaction.set(
        dailyRef,
        {
          count: FieldValue.increment(1),
          uniqueCount: visitorSnap.exists ? FieldValue.increment(0) : FieldValue.increment(1),
          date: dateKey,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo registrar la visita',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireSuperadmin(req);

    const params = req.nextUrl.searchParams;
    const from = params.get('from');
    const to = params.get('to');
    const limit = Math.min(Number(params.get('limit') || 90), 365);

    const totalSnap = await adminDb
      .collection('landingVisitStats')
      .doc('total')
      .get();

    let query: FirebaseFirestore.Query = adminDb.collection('landingVisitStats');

    if (from) {
      query = query.where('date', '>=', from);
    }

    if (to) {
      query = query.where('date', '<=', to);
    }

    const snap = await query.orderBy('date', 'desc').limit(limit).get();
    const days = snap.docs
      .filter((doc) => doc.id !== 'total')
      .map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          date: String(data.date || doc.id),
          count: Number(data.count || 0),
          uniqueCount: Number(data.uniqueCount || 0),
          updatedAt: serializeDate(data.updatedAt),
        };
      });

    return NextResponse.json({
      total: Number(totalSnap.data()?.count || 0),
      totalUnique: Number(totalSnap.data()?.uniqueCount || 0),
      days,
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
