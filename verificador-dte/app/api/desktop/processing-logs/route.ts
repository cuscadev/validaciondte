import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET environment variable');
}

function verifyDesktopToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getIdentity(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email || '',
      role: decoded.role || '',
    };
  } catch {
    const decoded = verifyDesktopToken(token);
    if (!decoded) return null;
    return {
      uid: String(decoded.uid || ''),
      email: String(decoded.email || ''),
      role: String(decoded.role || ''),
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await getIdentity(req);
    if (!identity) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const now = new Date();

    await adminDb.collection('processingLogs').add({
      uid: identity.uid,
      email: identity.email,
      role: identity.role,
      source: body.source || 'desktop',
      licenseKey: body.licenseKey || '',
      deviceId: body.deviceId || '',
      deviceName: body.deviceName || '',
      appVersion: body.appVersion || '',
      routeKey: body.routeKey || '',
      moduleName: body.moduleName || '',
      startedAt: body.startedAt ? new Date(body.startedAt) : now,
      endedAt: body.endedAt ? new Date(body.endedAt) : now,
      durationMs: Number(body.durationMs || 0),
      waitSeconds: Number(body.durationMs || 0) / 1000,
      files: {
        count: Number(body.files?.count || 0),
        totalBytes: Number(body.files?.totalBytes || 0),
        extensions: Array.isArray(body.files?.extensions) ? body.files.extensions : [],
        mimeTypes: Array.isArray(body.files?.mimeTypes) ? body.files.mimeTypes : [],
      },
      totalRecords: Number(body.totalRecords || 0),
      successCount: Number(body.successCount || 0),
      errorCount: Number(body.errorCount || 0),
      statusBreakdown: body.statusBreakdown || {},
      outcome: body.outcome || 'success',
      errorMessage: body.errorMessage || '',
      userAgent: body.userAgent || '',
      createdAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error guardando log' },
      { status: 500 }
    );
  }
}
