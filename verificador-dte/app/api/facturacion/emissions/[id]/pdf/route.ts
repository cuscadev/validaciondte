export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { buildDtePdfBuffer, getDteCode, sanitizeDteFileName } from '@/lib/facturacion/dte-artifacts';
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
    const pdf = await buildDtePdfBuffer(data, id);

    return new Response(pdf, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${sanitizeDteFileName(codigo)}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo generar PDF';
    const status = message === 'Emision no encontrada' ? 404 : message === 'No autorizado' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
