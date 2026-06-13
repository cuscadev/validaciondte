import { NextRequest, NextResponse } from 'next/server';

import { runImapSyncUntilComplete } from '@/lib/imap/sync';
import { requireOrgAdmin } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

    const maxBatches = body.jobId ? 1 : 3;

    const result = await runImapSyncUntilComplete({
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
    const message = error instanceof Error ? error.message : 'Error en sincronizacion.';
    console.error('[imap/sync]', error);
    const status =
      message === 'No autorizado'
        ? 401
        : message.includes('IMAP')
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
