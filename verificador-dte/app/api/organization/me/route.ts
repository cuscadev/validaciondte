import { NextRequest, NextResponse } from 'next/server';
import { getOrganization } from '@/lib/organization-admin';
import { requireOrgMember } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  try {
    const user = await requireOrgMember(req);
    if (!user.organizationId) {
      return NextResponse.json({ organization: null });
    }
    const org = await getOrganization(user.organizationId);
    return NextResponse.json({ organization: org, user: { role: user.role, orgRole: user.orgRole } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
