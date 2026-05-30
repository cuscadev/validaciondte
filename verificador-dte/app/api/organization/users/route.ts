import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  assertCanAddCollaborator,
  getOrganization,
  listCollaborators,
  syncCollaboratorCount,
} from '@/lib/organization-admin';
import { buildOrganizationDisplay } from '@/lib/org-display';
import { collaboratorInviteEmail, sendAppMail } from '@/lib/server-mail';
import { isValidEmailFormat } from '@/lib/email-invite';
import { requireOrgAdmin } from '@/lib/server-auth';
import { getUserDocByEmail, resolveInviteEmailConflict } from '@/lib/server-users';
import type { MembershipType } from '@/lib/firestoreUser';

function getAppBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://verificadordte.cuscadev.com';
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireOrgAdmin(req);
    const orgId = user.organizationId!;
    const org = await getOrganization(orgId);
    if (!org) {
      return NextResponse.json({ error: 'Organizacion no encontrada' }, { status: 404 });
    }

    const collaborators = await listCollaborators(orgId);
    const ownerSnap = await adminDb.collection('users').doc(org.ownerUid).get();
    const ownerData = ownerSnap.data();

    return NextResponse.json({
      organization: buildOrganizationDisplay(org),
      owner: ownerSnap.exists
        ? {
            uid: ownerSnap.id,
            email: String(ownerData?.email ?? ''),
            displayName: String(ownerData?.displayName ?? ''),
          }
        : null,
      collaborators,
      seats: {
        used: org.collaboratorCount ?? collaborators.length,
        max: org.maxCollaborators ?? 0,
        domain: org.allowedEmailDomain ?? '',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireOrgAdmin(req);
    const orgId = adminUser.organizationId!;
    const org = await assertCanAddCollaborator(orgId);

    const { email, displayName } = (await req.json()) as {
      email?: string;
      displayName?: string;
    };

    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const cleanName = String(displayName ?? '').trim();

    if (!normalizedEmail || !cleanName) {
      return NextResponse.json({ error: 'Correo y nombre requeridos' }, { status: 400 });
    }
    if (!isValidEmailFormat(normalizedEmail)) {
      return NextResponse.json({ error: 'Correo electronico invalido' }, { status: 400 });
    }

    const ownerSnap = await adminDb.collection('users').doc(org.ownerUid).get();
    const ownerEmail = String(ownerSnap.data()?.email ?? '').trim().toLowerCase();

    if (ownerEmail && normalizedEmail === ownerEmail) {
      return NextResponse.json(
        { error: 'No puedes invitar el correo del titular. Usa otro correo para el delegado.' },
        { status: 400 }
      );
    }

    const existingProfile = await getUserDocByEmail(normalizedEmail);
    if (existingProfile) {
      const conflict = resolveInviteEmailConflict({
        normalizedEmail,
        orgId,
        ownerUid: org.ownerUid,
        ownerEmail,
        existingUserDoc: existingProfile,
      });
      return NextResponse.json({ error: conflict.error }, { status: conflict.status });
    }

    try {
      await adminAuth.getUserByEmail(normalizedEmail);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== 'auth/user-not-found') throw err;
    }

    const pendingSnap = await adminDb
      .collection('collaboratorInvitations')
      .where('email', '==', normalizedEmail)
      .where('orgId', '==', orgId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!pendingSnap.empty) {
      return NextResponse.json(
        { error: 'Ya existe una invitacion pendiente para este correo.' },
        { status: 409 }
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48);
    const orgName = org.name;
    const membership: MembershipType = org.membershipType ?? 'free';

    await adminDb.collection('collaboratorInvitations').doc(token).set({
      token,
      email: normalizedEmail,
      displayName: cleanName,
      orgId,
      orgName,
      orgRole: 'miembro',
      membership,
      status: 'pending',
      invitedBy: adminUser.uid,
      createdAt: new Date(),
      expiresAt,
    });

    const inviteUrl = `${getAppBaseUrl()}/invitacion-colaborador?token=${token}`;
    const mail = collaboratorInviteEmail({ organizationName: orgName, inviteUrl });
    await sendAppMail({
      to: normalizedEmail,
      subject: `Invitacion a ${orgName} - Kaiser DTE`,
      ...mail,
    });

    await syncCollaboratorCount(orgId);

    return NextResponse.json({ success: true, email: normalizedEmail });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : message.includes('Limite') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
