import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SCANS = 50;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

type Identity = {
  uid: string;
  email: string;
  role: string;
};

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...(init?.headers || {}),
    },
  });
}

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

function verifyLegacyToken(token: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    return jwt.verify(token, secret) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getIdentity(req: NextRequest): Promise<Identity | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const user = userSnap.data() || {};

    return {
      uid: decoded.uid,
      email: decoded.email || String(user.email || ''),
      role: String(user.role || ''),
    };
  } catch {
    const decoded = verifyLegacyToken(token);
    if (!decoded?.uid) return null;

    return {
      uid: String(decoded.uid),
      email: String(decoded.email || ''),
      role: String(decoded.role || ''),
    };
  }
}

function toIso(value: unknown) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const timestamp = value as { toDate?: () => Date };
    return timestamp.toDate?.().toISOString() || '';
  }
  return '';
}

function toMillis(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const timestamp = value as { toMillis?: () => number };
    return timestamp.toMillis?.() || 0;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const timestamp = value as { toDate?: () => Date };
    return timestamp.toDate?.().getTime() || 0;
  }
  return 0;
}

function cleanName(value: unknown) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  return name.slice(0, 80) || `Lote mobile ${new Date().toLocaleString('es-SV')}`;
}

function cleanScanValue(value: unknown) {
  return String(value || '').trim();
}

export async function GET(req: NextRequest) {
  try {
    const identity = await getIdentity(req);
    if (!identity) return json({ error: 'No autorizado' }, { status: 401 });

    const snap = await adminDb
      .collection('mobileScanBatches')
      .where('uid', '==', identity.uid)
      .get();

    return json({
      batches: snap.docs
        .map((doc) => {
          const data = doc.data() || {};
          return {
            id: doc.id,
            name: data.name || '',
            status: data.status || 'pending',
            count: Number(data.count || data.scans?.length || 0),
            processedCount: Number(data.processedCount || data.results?.length || 0),
            createdAt: toIso(data.createdAt),
            updatedAt: toIso(data.updatedAt),
            processedAt: toIso(data.processedAt),
            sortTime: toMillis(data.createdAt),
            scans: Array.isArray(data.scans) ? data.scans : [],
            results: Array.isArray(data.results) ? data.results : [],
          };
        })
        .sort((a, b) => b.sortTime - a.sortTime)
        .slice(0, 30)
        .map(({ sortTime, ...batch }) => batch),
    });
  } catch (error) {
    console.error('[api/mobile-scans] Error listing batches', error);

    return json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await getIdentity(req);
    if (!identity) return json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const rawScans = Array.isArray(body?.scans) ? body.scans : [];

    if (rawScans.length === 0) {
      return json({ error: 'Envía al menos un escaneo.' }, { status: 400 });
    }

    const unique = new Map<string, { value: string; scannedAt: string }>();
    for (const scan of rawScans) {
      const value = cleanScanValue(scan?.value ?? scan);
      if (!value || unique.has(value)) continue;
      unique.set(value, {
        value,
        scannedAt: String(scan?.scannedAt || new Date().toISOString()),
      });
      if (unique.size >= MAX_SCANS) break;
    }

    const scans = Array.from(unique.values());
    if (scans.length === 0) {
      return json({ error: 'No se encontraron links válidos.' }, { status: 400 });
    }

    const now = new Date();
    const docRef = await adminDb.collection('mobileScanBatches').add({
      uid: identity.uid,
      email: identity.email,
      role: identity.role,
      name: cleanName(body?.name),
      status: 'pending',
      scans,
      results: [],
      count: scans.length,
      processedCount: 0,
      source: 'mobile',
      createdAt: now,
      updatedAt: now,
    });

    return json({
      success: true,
      batch: {
        id: docRef.id,
        count: scans.length,
      },
    });
  } catch (error) {
    console.error('[api/mobile-scans] Error creating batch', error);

    return json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
