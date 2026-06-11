import { NextRequest, NextResponse } from 'next/server';

import {
  getActiveConnection,
  getLastSyncJob,
  revokeConnection,
} from '@/lib/gmail/firebase-db';
import { decryptSecret } from '@/lib/gmail/token-crypto';
import { revokeRefreshToken } from '@/lib/gmail/oauth';
import { requireOrgAdmin } from '@/lib/server-auth';
import { getGmailPublicErrorMessage } from '@/lib/gmail/callback-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireOrgAdmin(req);
    if (!user.organizationId) {
      return NextResponse.json({ connected: false }, { status: 200 });
    }

    const connection = await getActiveConnection(user.organizationId);
    const lastJob = await getLastSyncJob(user.organizationId);

    return NextResponse.json({
      connected: Boolean(connection),
      googleEmail: connection?.google_email ?? null,
      connectedAt: connection?.updated_at ?? null,
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
    const message = getGmailPublicErrorMessage(error);
    console.error('[gmail/status]', error);
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

    const connection = await getActiveConnection(user.organizationId);
    if (connection) {
      try {
        const refresh = decryptSecret(connection.refresh_token_enc);
        await revokeRefreshToken(refresh);
      } catch (revokeErr) {
        console.warn('[gmail disconnect revoke]', revokeErr);
      }
      await revokeConnection(user.organizationId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = getGmailPublicErrorMessage(error);
    console.error('[gmail/status]', error);
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
