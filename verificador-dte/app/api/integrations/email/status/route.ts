import { NextRequest, NextResponse } from 'next/server';

import { getLastSyncJob, listConnections } from '@/lib/email/db';
import {
  EMAIL_PROVIDER_PRESETS,
  inferEmailProvider,
  normalizeEmailAddress,
} from '@/lib/email/provider-presets';
import { requireOrgAdmin } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireOrgAdmin(req);
    const accountEmailRaw = normalizeEmailAddress(user.email || '');
    const accountEmail =
      accountEmailRaw && accountEmailRaw.includes('@') ? accountEmailRaw : null;
    const suggestedProvider = accountEmail ? inferEmailProvider(accountEmail) : null;

    if (!user.organizationId) {
      return NextResponse.json({
        connections: [],
        accountEmail,
        suggestedProvider,
      });
    }

    const connections = await listConnections(user.organizationId);
    const enriched = await Promise.all(
      connections.map(async (connection) => {
        const lastJob = await getLastSyncJob(user.organizationId, connection.id);
        return {
          id: connection.id,
          provider: connection.provider,
          providerLabel: EMAIL_PROVIDER_PRESETS[connection.provider].label,
          emailAddress: connection.email_address,
          authMethod: connection.auth_method || 'app_password',
          connectedAt: connection.created_at,
          lastSync: lastJob
            ? {
                id: lastJob.id,
                status: lastJob.status,
                dateFrom: lastJob.date_from,
                dateTo: lastJob.date_to,
                importedCount: lastJob.imported_count,
                skippedCount: lastJob.skipped_count,
                finishedAt: lastJob.finished_at,
              }
            : null,
        };
      })
    );

    return NextResponse.json({
      connections: enriched,
      accountEmail,
      suggestedProvider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
