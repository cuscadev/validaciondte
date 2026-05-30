import { NextRequest, NextResponse } from 'next/server';
import { getOrganization, updateOrganization } from '@/lib/organization-admin';
import {
  buildOrganizationDisplay,
  getOrgDisplayTitle,
  isNaturalOrganization,
  sanitizeGroupName,
} from '@/lib/org-display';
import { requireAuth } from '@/lib/server-auth';

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (user.role !== 'cliente') {
      return NextResponse.json(
        { error: 'Solo el titular de la cuenta puede actualizar los datos fiscales.' },
        { status: 403 }
      );
    }
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organización' }, { status: 400 });
    }

    const org = await getOrganization(user.organizationId);
    if (!org) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
    }
    if (!isNaturalOrganization(org)) {
      return NextResponse.json(
        { error: 'El nombre del grupo solo aplica a persona natural.' },
        { status: 400 }
      );
    }

    const { groupName } = (await req.json()) as { groupName?: string | null };
    const groupNameValue =
      typeof groupName === 'string' && groupName.trim()
        ? sanitizeGroupName(groupName)
        : null;

    const updatedKyc = { ...org.kyc, groupName: groupNameValue };
    const displayTitle = getOrgDisplayTitle({ name: org.name, kyc: updatedKyc });

    await updateOrganization(user.organizationId, {
      name: displayTitle,
      kyc: updatedKyc,
    });

    const refreshed = await getOrganization(user.organizationId);
    return NextResponse.json({
      success: true,
      organization: refreshed,
      display: refreshed ? buildOrganizationDisplay(refreshed) : null,
    });
  } catch (error) {
    console.error('[organization/kyc PATCH]', error);
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
