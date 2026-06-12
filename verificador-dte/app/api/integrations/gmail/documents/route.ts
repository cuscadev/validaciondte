import { NextRequest, NextResponse } from 'next/server';

import { listDocuments } from '@/lib/gmail/firebase-db';
import { requireOrgMember } from '@/lib/server-auth';
import { getGmailPublicErrorMessage } from '@/lib/gmail/callback-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireOrgMember(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion.' }, { status: 400 });
    }

    const params = req.nextUrl.searchParams;
    const syncJobId = params.get('syncJobId') || undefined;
    const importStatus = params.get('importStatus') || 'imported';
    const tipoDte = params.get('tipoDte') || undefined;
    const dateFrom = params.get('dateFrom') || undefined;
    const dateTo = params.get('dateTo') || undefined;
    const q = params.get('q') || undefined;
    const source = params.get('source') || undefined;
    const mailbox = params.get('mailbox') || undefined;
    const limit = Number(params.get('limit') || 50);
    const offset = Number(params.get('offset') || 0);

    const { documents, total } = await listDocuments({
      organizationId: user.organizationId,
      syncJobId,
      importStatus,
      tipoDte,
      dateFrom,
      dateTo,
      q,
      source,
      mailbox,
      limit: Math.min(Math.max(limit, 1), 200),
      offset: Math.max(offset, 0),
    });

    return NextResponse.json({ documents, total });
  } catch (error) {
    const message = getGmailPublicErrorMessage(error);
    console.error('[gmail/documents]', error);
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
