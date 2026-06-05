import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import { createOrganizationForOwner } from '@/lib/organization-admin';
import { generateTemporaryPassword, sendAppMail, temporaryPasswordEmail } from '@/lib/server-mail';
import { requireSuperadmin } from '@/lib/server-auth';

function getAppBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://verificadordtev2.cuscadev.com';
}

export async function POST(req: NextRequest) {
  try {
    await requireSuperadmin(req);
    const { requestId, membershipType } = await req.json();
    if (!requestId) {
      return NextResponse.json({ error: 'Falta requestId' }, { status: 400 });
    }

    const reqDoc = await adminDb.collection('accessRequests').doc(requestId).get();
    if (!reqDoc.exists) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    const data = reqDoc.data()!;
    const { nombre, email, authUid } = data;

    if (!email) {
      return NextResponse.json({ error: 'La solicitud no tiene email' }, { status: 400 });
    }

    const plan = membershipType === 'premium' || membershipType === 'pro' ? membershipType : 'free';
    const auth = getAuth(getApp());
    const temporaryPassword = generateTemporaryPassword();
    const loginUrl = `${getAppBaseUrl()}/login`;

    let uid: string;
    if (authUid) {
      const existing = await auth.getUser(authUid);
      await auth.updateUser(existing.uid, {
        displayName: nombre || email,
        password: temporaryPassword,
        emailVerified: true,
        disabled: false,
      });
      uid = existing.uid;
    } else {
      try {
        const existing = await auth.getUserByEmail(email);
        await auth.updateUser(existing.uid, {
          displayName: nombre || email,
          password: temporaryPassword,
          emailVerified: true,
          disabled: false,
        });
        uid = existing.uid;
      } catch {
        const userRecord = await auth.createUser({
          email,
          password: temporaryPassword,
          displayName: nombre || email,
          emailVerified: true,
          disabled: false,
        });
        uid = userRecord.uid;
      }
    }

    await createOrganizationForOwner({
      ownerUid: uid,
      name: nombre || email,
      email,
      membershipType: plan,
    });

    await adminDb.collection('users').doc(uid).set({
      uid,
      email,
      displayName: nombre || email,
      role: 'cliente',
      organizationId: uid,
      membership: {
        type: plan,
        expiresAt: '',
      },
      accountStatus: 'active',
      onboardingCompleted: false,
      createdAt: new Date(),
      active: true,
      mustChangePassword: true,
      temporaryPasswordIssuedAt: new Date(),
    }, { merge: true });

    await adminDb.collection('accessRequests').doc(requestId).update({
      status: 'approved',
      approvedAt: new Date(),
      approvedUid: uid,
      approvedMembership: plan,
    });

    const emailContent = temporaryPasswordEmail({
      temporaryPassword,
      title: 'Tu acceso a Kaiser DTE fue aprobado',
      intro: 'Tu solicitud fue aprobada. Inicia sesion con tu correo y la contrasena temporal. Veras un asistente paso a paso para definir tu nueva contrasena y completar tu registro fiscal (conoce a tu cliente) antes de acceder al panel.',
      actionHref: loginUrl,
    });

    await sendAppMail({
      to: email,
      subject: 'Bienvenido a Kaiser DTE — acceso aprobado',
      ...emailContent,
    });

    await adminDb.collection('notifications').add({
      type: 'admin_message',
      title: 'Tu solicitud fue aprobada',
      body: 'Revisa tu correo para la contrasena temporal y completa el onboarding.',
      targetUid: uid,
      readBy: [],
      createdAt: Timestamp.now(),
      metadata: { emailSent: true },
    });

    return NextResponse.json({ success: true, uid });
  } catch (error) {
    console.error('Error aprobando solicitud:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 });
  }
}
