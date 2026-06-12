import { NextRequest, NextResponse } from 'next/server';

import { getLastSyncJob } from '@/lib/gmail/firebase-db';
import { getActiveImapConnection, revokeImapConnection } from '@/lib/imap/firebase-db';
import { requireOrgAdmin } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireOrgAdmin(req);
    if (!user.organizationId) {
      return NextResponse.json({ connected: false }, { status: 200 });
    }

    const connection = await getActiveImapConnection(user.organizationId);
    const lastJob = await getLastSyncJob(user.organizationId, 'imap');

    return NextResponse.json({
      connected: Boolean(connection),
      email: connection?.email ?? null,
      host: connection?.host ?? null,
      port: connection?.port ?? null,
      provider: connection?.provider ?? null,
      authType: connection?.auth_type ?? null,
      connectedAt: connection?.updated_at ?? null,
      consentAcceptedAt: connection?.consent_accepted_at ?? null,
      lastSync: lastJob
        ? {
            id: lastJob.id,
            status: lastJob.status,
            dateFrom: lastJob.date_from,
            dateTo: lastJob.date_to,
            foundCount: lastJob.found_count,
            importedCount: lastJob.imported_count,
            skippedCount: lastJob.skipped_count,
            finishedAt: lastJob.finished_at,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    console.error('[imap/status]', error);
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireOrgAdmin(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion.' }, { status: 400 });
    }

    const connection = await getActiveImapConnection(user.organizationId);
    if (connection) {
      await revokeImapConnection(user.organizationId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    console.error('[imap/status]', error);
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
