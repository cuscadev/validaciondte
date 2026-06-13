import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { createOrganizationForOwner, getOrganization, updateOrganization } from '@/lib/organization-admin';
import { getOrgDisplayTitle } from '@/lib/org-display';
import type { Organization, PersonType } from '@/lib/organization-types';
import { requireAuth } from '@/lib/server-auth';
import { syncAppUserAfterFirestoreWrite } from '@/lib/server-user-sync';

function onlyDigits(value: string | undefined) {
  return (value ?? '').replace(/\D/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (user.role !== 'cliente') {
      return NextResponse.json({ error: 'Solo el titular de la cuenta puede completar el onboarding.' }, { status: 403 });
    }
    const organizationId = user.organizationId || user.uid;
    let organization = await getOrganization(organizationId);
    if (!organization) {
      organization = await createOrganizationForOwner({
        ownerUid: user.uid,
        name: user.displayName || user.email,
        email: user.email,
        membershipType: user.membership?.type,
      });
    }

    const body = await req.json();
    const {
      fullLegalName,
      personType,
      hasHomologatedDui,
      dui,
      nit,
      nrc,
      fiscalAddress,
      companyLegalName,
      companyNit,
      companyNrc,
      companyNcr,
      termsAccepted,
      privacyAccepted,
    } = body as {
      fullLegalName?: string;
      personType?: PersonType;
      hasHomologatedDui?: boolean;
      dui?: string;
      nit?: string;
      nrc?: string;
      fiscalAddress?: string;
      companyLegalName?: string;
      companyNit?: string;
      companyNrc?: string;
      companyNcr?: string;
      termsAccepted?: boolean;
      privacyAccepted?: boolean;
    };

    const legalName = fullLegalName?.trim() || user.displayName?.trim() || user.email;
    if (!legalName) {
      return NextResponse.json({ error: 'No se encontrÃ³ el nombre de la solicitud de acceso.' }, { status: 400 });
    }
    if (personType !== 'natural' && personType !== 'juridica') {
      return NextResponse.json({ error: 'Tipo de persona inválido' }, { status: 400 });
    }

    if (termsAccepted !== true || privacyAccepted !== true) {
      return NextResponse.json({ error: 'Debes aceptar los términos y la política de privacidad.' }, { status: 400 });
    }

    if (personType === 'natural') {
      if (typeof hasHomologatedDui !== 'boolean') {
        return NextResponse.json({ error: 'Indica si tienes DUI homologado' }, { status: 400 });
      }
      if (hasHomologatedDui && onlyDigits(dui).length !== 9) {
        return NextResponse.json({ error: 'DUI requerido con 9 dÃ­gitos' }, { status: 400 });
      }
      if (!hasHomologatedDui && onlyDigits(nit).length !== 14) {
        return NextResponse.json({ error: 'NIT requerido con 14 dÃ­gitos si no tienes DUI homologado' }, { status: 400 });
      }
      if (!nrc?.trim()) {
        return NextResponse.json({ error: 'NRC requerido' }, { status: 400 });
      }
      if (!fiscalAddress?.trim()) {
        return NextResponse.json({ error: 'DirecciÃ³n requerida' }, { status: 400 });
      }
    } else {
      const companyNrcValue = companyNrc ?? companyNcr;
      if (!companyLegalName?.trim() || onlyDigits(companyNit).length !== 14 || !companyNrcValue?.trim() || !fiscalAddress?.trim()) {
        return NextResponse.json({ error: 'Nombre empresa, NIT, NRC y direcciÃ³n son obligatorios' }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const kyc = {
      onboardingCompleted: true,
      kycCompleted: true,
      personType,
      fullLegalName: legalName,
      hasHomologatedDui: personType === 'natural' ? hasHomologatedDui : null,
      dui: personType === 'natural' && hasHomologatedDui ? dui?.trim() : null,
      nit: personType === 'natural' ? nit?.trim() : personType === 'juridica' ? companyNit?.trim() : null,
      nrc: personType === 'natural' ? nrc?.trim() : null,
      fiscalAddress: fiscalAddress?.trim() || null,
      companyLegalName: personType === 'juridica' ? companyLegalName?.trim() : null,
      companyNit: personType === 'juridica' ? companyNit?.trim() : null,
      companyNrc: personType === 'juridica' ? (companyNrc ?? companyNcr)?.trim() : null,
      companyNcr: personType === 'juridica' ? (companyNrc ?? companyNcr)?.trim() : null,
      groupName: null,
      termsAccepted: true,
      privacyAccepted: true,
      acceptedLegalAt: now,
      kycCompletedAt: now,
    };

    const orgForTitle = { name: '', kyc } as Organization;
    const displayTitle = getOrgDisplayTitle(orgForTitle);

    await updateOrganization(organizationId, {
      name: displayTitle,
      kyc,
    });

    const userPatch: Record<string, unknown> = {
      displayName: legalName,
      organizationId,
      onboardingCompleted: true,
      updatedAt: new Date(),
    };
    if (personType === 'juridica') {
      userPatch.company = companyLegalName!.trim();
    }

    await adminDb.collection('users').doc(user.uid).set(userPatch, { merge: true });
    await syncAppUserAfterFirestoreWrite(user.uid);

    const org = await getOrganization(organizationId);
    return NextResponse.json({ success: true, organization: org });
  } catch (error) {
    console.error('[organization/onboarding]', error);
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
