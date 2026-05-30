import { NextRequest, NextResponse } from 'next/server';
import { listCollaborators } from '@/lib/organization-admin';
import { requireSuperadmin } from '@/lib/server-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireSuperadmin(req);
    const { orgId } = await params;
    const collaborators = await listCollaborators(orgId);
    return NextResponse.json({ collaborators });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: error instanceof Error && error.message === 'No autorizado' ? 401 : 500 }
    );
  }
}
