export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { assertEmisionAccess } from '@/lib/facturacion/emisiones-store';
import { requireAuth } from '@/lib/server-auth';

function sanitizeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, '_') || 'factura-prueba';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(req);
    if (user.role !== 'cliente' && user.role !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id } = await params;
    const data = await assertEmisionAccess(id, user.uid, user.role);
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
    const message = error instanceof Error ? error.message : 'No autorizado';
    const status = message === 'Emision no encontrada' ? 404 : message === 'No autorizado' ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
