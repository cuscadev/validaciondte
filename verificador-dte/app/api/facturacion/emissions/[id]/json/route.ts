export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { buildDteJsonBuffer, getDteCode, sanitizeDteFileName } from '@/lib/facturacion/dte-artifacts';
import { assertEmisionAccess } from '@/lib/facturacion/emisiones-store';
import { requireAuth } from '@/lib/server-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const data = await assertEmisionAccess(id, user.uid, user.role);
    const codigo = getDteCode(data, id);

    return new Response(buildDteJsonBuffer(data), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${sanitizeDteFileName(codigo)}.json"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No autorizado';
    const status = message === 'Emision no encontrada' ? 404 : message === 'No autorizado' ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
