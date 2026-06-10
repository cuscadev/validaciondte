import { NextRequest, NextResponse } from 'next/server';

import { verifyEmailDocumentsFromStorage } from '@/lib/email/verify-json-from-storage';
import { requireOrgMember } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireOrgMember(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion.' }, { status: 400 });
    }

    const body = (await req.json()) as { documentIds?: string[] };
    const ids = Array.isArray(body.documentIds) ? body.documentIds.filter(Boolean) : [];
    if (!ids.length) {
      return NextResponse.json({ error: 'Indica documentIds.' }, { status: 400 });
    }

    const { resultados, processedCount } = await verifyEmailDocumentsFromStorage({
      organizationId: user.organizationId,
      documentIds: ids.slice(0, 25),
    });

    if (!resultados.length) {
      return NextResponse.json(
        { error: 'Ningun documento importado valido para verificar.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ resultados, processedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
