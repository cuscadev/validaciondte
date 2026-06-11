import { NextRequest, NextResponse } from 'next/server';

import { downloadDocumentJson } from '@/lib/gmail/firebase-db';
import { requireOrgMember } from '@/lib/server-auth';
import { getPublicServiceErrorMessage } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireOrgMember(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion.' }, { status: 400 });
    }

    const { id } = await context.params;
    const buffer = await downloadDocumentJson(id, user.organizationId);
    if (!buffer) {
      return NextResponse.json({ error: 'JSON no encontrado.' }, { status: 404 });
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `inline; filename="${id}.json"`,
      },
    });
  } catch (error) {
    const message = getPublicServiceErrorMessage(error);
    console.error('[gmail/documents/raw]', error);
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
