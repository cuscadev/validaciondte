import { NextRequest, NextResponse } from 'next/server';

import {
  createSyncJob,
  updateSyncJob,
  waitForSyncJobCompletion,
} from '@/lib/email/db';
import { startEmailSyncViaGo } from '@/lib/go-dte-api';
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
      connectionId?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    if (!body.connectionId) {
      return NextResponse.json({ error: 'Indica connectionId.' }, { status: 400 });
    }
    if (!body.dateFrom || !body.dateTo) {
      return NextResponse.json({ error: 'Indica dateFrom y dateTo.' }, { status: 400 });
    }

    const job = await createSyncJob({
      organizationId: user.organizationId,
      connectionId: body.connectionId,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      createdByUid: user.uid,
    });

    try {
      await startEmailSyncViaGo({
        jobId: job.id,
        organizationId: user.organizationId,
        connectionId: body.connectionId,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
        createdByUid: user.uid,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error al iniciar sincronizacion en Go';
      await updateSyncJob(job.id, {
        status: 'failed',
        error_message: message,
        finished_at: new Date().toISOString(),
      });
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const { job: finalJob, results } = await waitForSyncJobCompletion(
      job.id,
      user.organizationId
    );

    return NextResponse.json({
      job: finalJob,
      results,
      total: results.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status =
      message === 'No autorizado'
        ? 401
        : message.includes('correo') || message.includes('Indica')
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
