export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/server-auth';

function sanitizeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, '_') || 'factura-prueba';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperadmin(req);
    const { id } = await params;
    const snap = await adminDb.collection('facturacionEmisiones').doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Emision no encontrada' }, { status: 404 });
    }

    const data = snap.data() || {};
    const finalPackage = data.finalPackage || data;
    const codigo = typeof data.codigoGeneracion === 'string' ? data.codigoGeneracion : id;
    const body = JSON.stringify(finalPackage, null, 2);

    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${sanitizeFileName(codigo)}.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No autorizado' },
      { status: 401 }
    );
  }
}
