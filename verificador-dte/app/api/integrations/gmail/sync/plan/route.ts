import { NextRequest, NextResponse } from 'next/server';

import { listCompletedSyncJobs } from '@/lib/gmail/firebase-db';
import { resolveSyncPlan } from '@/lib/email-import/sync-plan';
import { countDocumentsInRange } from '@/lib/email-import/documents-api';
import { requireOrgAdmin } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireOrgAdmin(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion.' }, { status: 400 });
    }

    const dateFrom = req.nextUrl.searchParams.get('dateFrom')?.trim() || '';
    const dateTo = req.nextUrl.searchParams.get('dateTo')?.trim() || '';
    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'Indica dateFrom y dateTo.' },
        { status: 400 }
      );
    }
    if (dateFrom > dateTo) {
      return NextResponse.json(
        { error: 'La fecha inicial no puede ser mayor que la final.' },
        { status: 400 }
      );
    }

    const completedJobs = await listCompletedSyncJobs(user.organizationId, 'gmail');
    const syncPlan = resolveSyncPlan({ dateFrom, dateTo, completedJobs });

    if (syncPlan.action === 'cache_hit') {
      syncPlan.documentCount = await countDocumentsInRange({
        organizationId: user.organizationId,
        dateFrom,
        dateTo,
        source: 'gmail',
      });
    }

    return NextResponse.json({ syncPlan });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
