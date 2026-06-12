import { NextRequest, NextResponse } from 'next/server';

import { runImapSyncBatch } from '@/lib/imap/sync';
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

    const result = await runImapSyncBatch({
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
