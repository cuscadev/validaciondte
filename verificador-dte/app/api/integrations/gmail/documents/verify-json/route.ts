import { NextRequest, NextResponse } from 'next/server';

import { verifyGmailDocumentsFromStorage } from '@/lib/gmail/verify-json-from-storage';
import { requireOrgMember } from '@/lib/server-auth';
import { getGmailPublicErrorMessage } from '@/lib/gmail/callback-errors';

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

    const { resultados, processedCount } = await verifyGmailDocumentsFromStorage({
      organizationId: user.organizationId,
      documentIds: ids,
    });

    return NextResponse.json({ resultados, processedCount });
  } catch (error) {
    const message = getGmailPublicErrorMessage(error);
    console.error('[gmail/documents/verify-json]', error);
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
