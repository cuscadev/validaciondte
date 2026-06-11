import { NextRequest, NextResponse } from 'next/server';

import { getLinkedDocuments } from '@/lib/gmail/firebase-db';
import { requireOrgMember } from '@/lib/server-auth';
import { getGmailPublicErrorMessage } from '@/lib/gmail/callback-errors';

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
    const { links, documents } = await getLinkedDocuments(id, user.organizationId);

    return NextResponse.json({ links, documents });
  } catch (error) {
    const message = getGmailPublicErrorMessage(error);
    console.error('[gmail/documents/links]', error);
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
