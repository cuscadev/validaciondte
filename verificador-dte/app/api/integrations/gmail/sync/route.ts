import { NextRequest, NextResponse } from 'next/server';

import { runSyncUntilComplete } from '@/lib/gmail/sync';
import { requireOrgAdmin } from '@/lib/server-auth';
import { getGmailPublicErrorMessage } from '@/lib/gmail/callback-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireOrgAdmin(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion.' }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      dateFrom?: string;
      dateTo?: string;
      jobId?: string;
    };

    const maxBatches = body.jobId ? 1 : 6;

    const result = await runSyncUntilComplete({
      organizationId: user.organizationId,
      createdByUid: user.uid,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      jobId: body.jobId,
      maxBatches,
    });

    return NextResponse.json({
      job: result.job,
      batchDocuments: result.batchDocuments,
      syncPlan: result.syncPlan,
    });
  } catch (error) {
    const message = getGmailPublicErrorMessage(error);
    console.error('[gmail/sync]', error);
    const status =
      message === 'No autorizado'
        ? 401
        : message.includes('Gmail')
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
