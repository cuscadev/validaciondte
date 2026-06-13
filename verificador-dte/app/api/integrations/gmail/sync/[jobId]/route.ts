import { NextRequest, NextResponse } from 'next/server';

import { getSyncJob } from '@/lib/gmail/firebase-db';
import { listDocuments } from '@/lib/email-import/documents-api';
import { requireOrgAdmin } from '@/lib/server-auth';
import { getGmailPublicErrorMessage } from '@/lib/gmail/callback-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ jobId: string }> };

export async function GET(req: NextRequest, context: Params) {
  try {
    const user = await requireOrgAdmin(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion.' }, { status: 400 });
    }

    const { jobId } = await context.params;
    const job = await getSyncJob(jobId, user.organizationId);
    if (!job) {
      return NextResponse.json({ error: 'Trabajo no encontrado.' }, { status: 404 });
    }

    const { documents, total } = await listDocuments({
      organizationId: user.organizationId,
      syncJobId: jobId,
      limit: 200,
    });

    return NextResponse.json({ job, documents, total });
  } catch (error) {
    const message = getGmailPublicErrorMessage(error);
    console.error('[gmail/sync/job]', error);
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
