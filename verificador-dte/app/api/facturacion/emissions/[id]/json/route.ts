export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-auth';
import { buildDteJsonBuffer, getDteCode, sanitizeDteFileName } from '@/lib/facturacion/dte-artifacts';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const snap = await adminDb.collection('facturacionEmisiones').doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Emision no encontrada' }, { status: 404 });
    }

    const data = snap.data() || {};
    if (user.role !== 'superadmin' && data.uid !== user.uid) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const codigo = getDteCode(data, id);

    return new Response(buildDteJsonBuffer(data), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${sanitizeDteFileName(codigo)}.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No autorizado' },
      { status: 401 }
    );
  }
}
