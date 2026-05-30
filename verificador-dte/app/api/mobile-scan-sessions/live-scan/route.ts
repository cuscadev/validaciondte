import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

async function getUid(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return '';

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    const decoded = verifyLegacyToken(token);
    return decoded?.uid ? String(decoded.uid) : '';
  }
}

const DEFAULT_MOBILE_SCAN_LIMITS: Record<string, number | null> = {
  free: 25,
  premium: 50,
  pro: 100,
};

async function getUserDoc(uid: string) {
  const byId = await adminDb.collection('users').doc(uid).get();
  if (byId.exists) return byId.data() || {};

  const byFirebaseUid = await adminDb
    .collection('users')
    .where('firebaseUid', '==', uid)
    .limit(1)
    .get();

  return byFirebaseUid.docs[0]?.data() || {};
}

async function getMobileScanFolderLimit(uid: string) {
  const user = await getUserDoc(uid);
  if (user?.role === 'superadmin') return null;

  const planType = String(user?.membership?.type || 'free').toLowerCase();
  const plansSnap = await adminDb.doc('config/plans').get();
  const plans = plansSnap.data() || {};
  const configured = plans?.[planType]?.mobileScanFolderLimit;

  if (configured === null) return null;
  if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }

  return DEFAULT_MOBILE_SCAN_LIMITS[planType] ?? DEFAULT_MOBILE_SCAN_LIMITS.free;
}

function cleanScanValue(value: unknown) {
  return String(value || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const uid = await getUid(req);
    if (!uid) return json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const code = String(body?.code || '').trim();
    const value = cleanScanValue(body?.scan?.value || body?.value);

    if (!code || !value) {
      return json(
        { error: 'code y scan.value son requeridos.' },
        { status: 400 }
      );
    }

    const folderLimit = await getMobileScanFolderLimit(uid);

    const sessionSnap = await adminDb
      .collection('mobileScanSessions')
      .where('folderCodes', 'array-contains', code)
      .get();

    const activeSessionDoc = sessionSnap.docs.find((doc) => doc.data()?.active);

    if (!activeSessionDoc) {
      return json({ error: 'Código de sesión inválido o vencido.' }, { status: 404 });
    }

    const sessionRef = activeSessionDoc.ref;
    const result = await adminDb.runTransaction(async (tx) => {
      const fresh = await tx.get(sessionRef);
      const session = fresh.data() || {};

      if (session.uid !== uid) {
        throw new Error('Este código pertenece a otro usuario.');
      }

      const folders = Array.isArray(session.folders)
        ? [...session.folders]
        : [];

      const folderIndex = folders.findIndex(
        (folder) => String(folder.code || '') === code
      );

      if (folderIndex < 0) {
        throw new Error('Código de carpeta inválido.');
      }

      const folder = folders[folderIndex];
      const scans = Array.isArray(folder.scans) ? [...folder.scans] : [];

      if (scans.some((scan) => scan.value === value)) {
        return {
          duplicated: true,
          folderId: folder.id,
          count: scans.length,
        };
      }

      if (folderLimit !== null && scans.length >= folderLimit) {
        throw new Error(`Esta carpeta ya llegó al máximo de ${folderLimit} escaneos según tu membresía.`);
      }

      scans.push({
        id: `${Date.now()}-${scans.length}`,
        value,
        scannedAt: String(body?.scan?.scannedAt || new Date().toISOString()),
      });

      folders[folderIndex] = {
        ...folder,
        scans,
        status: 'pending',
        updatedAt: new Date().toISOString(),
      };

      tx.update(sessionRef, {
        folders,
        updatedAt: new Date(),
      });

      return {
        duplicated: false,
        folderId: folder.id,
        count: scans.length,
      };
    });

    return json({ success: true, ...result });
  } catch (error) {
    console.error('[api/mobile-scan-sessions/live-scan] Error saving scan', error);

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
