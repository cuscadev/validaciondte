import { NextRequest, NextResponse } from 'next/server';

import { listDocuments } from '@/lib/gmail/db';
import { runSyncBatch } from '@/lib/gmail/sync';
import { requireOrgAdmin } from '@/lib/server-auth';
import { getPublicServiceErrorMessage } from '@/lib/supabase-admin';

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

    const result = await runSyncBatch({
      organizationId: user.organizationId,
      createdByUid: user.uid,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      jobId: body.jobId,
    });

    return NextResponse.json({
      job: result.job,
      batchDocuments: result.batchDocuments,
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Error';
    const message = rawMessage.includes('Gmail')
      ? rawMessage
      : getPublicServiceErrorMessage(error);
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
