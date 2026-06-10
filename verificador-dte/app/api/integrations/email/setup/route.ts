import { NextRequest, NextResponse } from 'next/server';

import { getEmailIntegrationSetupStatus } from '@/lib/email/setup-status';
import {
  inferEmailProvider,
  normalizeEmailAddress,
} from '@/lib/email/provider-presets';
import {
  canManageOrgUsers,
  resolveOrganizationId,
} from '@/lib/firestoreUser';
import { requireAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!canManageOrgUsers(user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const organizationId = resolveOrganizationId(user);
    const setup = await getEmailIntegrationSetupStatus({
      organizationLinked: Boolean(organizationId),
    });

    const isSuperadmin = user.role === 'superadmin';
    const accountEmailRaw = normalizeEmailAddress(user.email || '');
    const accountEmail =
      accountEmailRaw && accountEmailRaw.includes('@') ? accountEmailRaw : null;
    const suggestedProvider = accountEmail ? inferEmailProvider(accountEmail) : null;

    if (!isSuperadmin) {
      return NextResponse.json({
        ready: setup.ready,
        organizationLinked: Boolean(organizationId),
        accountEmail,
        suggestedProvider,
      });
    }

    const checks = setup.checks;

    return NextResponse.json({
      ready: setup.ready,
      organizationLinked: Boolean(organizationId),
      isSuperadmin: true,
      supabaseProjectRef: setup.supabaseProjectRef,
      accountEmail,
      suggestedProvider,
      checks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
