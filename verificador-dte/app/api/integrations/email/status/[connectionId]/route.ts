import { NextRequest, NextResponse } from 'next/server';

import { revokeConnectionById } from '@/lib/email/db';
import { requireOrgAdmin } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ connectionId: string }> };

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireOrgAdmin(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion.' }, { status: 400 });
    }

    const { connectionId } = await context.params;
    await revokeConnectionById(connectionId, user.organizationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
