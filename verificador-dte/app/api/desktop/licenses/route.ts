import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminDb } from '@/lib/firebase-admin';
import { generateTemporaryPassword, sendAppMail, temporaryPasswordEmail } from '@/lib/server-mail';
import { requireSuperadmin } from '@/lib/server-auth';

function serializeDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.toDate === 'function') {
      return (record.toDate as () => Date)().toISOString();
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    await requireSuperadmin(req);
    const params = req.nextUrl.searchParams;
    const query = (params.get('q') || '').trim().toLowerCase();

    const snap = await adminDb.collection('desktopLicenses').orderBy('updatedAt', 'desc').limit(500).get();
    let licenses = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        active: data.active !== false,
        plan: typeof data.plan === 'string' ? data.plan : 'desktop',
        userEmail: typeof data.userEmail === 'string' ? data.userEmail : '',
        userId: typeof data.userId === 'string' ? data.userId : '',
        expiresAt: serializeDate(data.expiresAt),
        allowedDevices: Array.isArray(data.allowedDevices) ? data.allowedDevices : [],
        updatedAt: data.updatedAt,
      };
    });

    if (query) {
      licenses = licenses.filter((license) => {
        const userEmail = String(license.userEmail || '').toLowerCase();
        const userId = String(license.userId || '').toLowerCase();
        const id = String(license.id || '').toLowerCase();
        return id.includes(query) || userEmail.includes(query) || userId.includes(query);
      });
    }

    return NextResponse.json({ licenses });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No autorizado' },
      { status: 403 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSuperadmin(req);
    const body = await req.json();
    const licenseKey = String(body.licenseKey || '').trim();
    const userEmail = String(body.userEmail || '').trim().toLowerCase();
    const userId = String(body.userId || '').trim();
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (!licenseKey) {
      return NextResponse.json({ error: 'licenseKey es requerido' }, { status: 400 });
    }

    const licenseRef = adminDb.collection('desktopLicenses').doc(licenseKey);
    const existingLicenseSnap = await licenseRef.get();
    const isNewLicense = !existingLicenseSnap.exists;

    const existingLicense = existingLicenseSnap.exists ? existingLicenseSnap.data() : null;
    let finalUserId: string | null = userId || (existingLicense?.userId as string) || null;
    let finalUserEmail: string | null = userEmail || (existingLicense?.userEmail as string) || null;
    let shouldSendPassword = false;
    let temporaryPassword = '';

    if (isNewLicense && userEmail) {
      shouldSendPassword = true;
      temporaryPassword = generateTemporaryPassword();

      const userCollection = adminDb.collection('users');
      let userDoc;

      if (userId) {
        const userSnap = await userCollection.doc(userId).get();
        if (userSnap.exists) {
          userDoc = userSnap;
        }
      }

      if (!userDoc) {
        const emailSnap = await userCollection.where('email', '==', userEmail).limit(1).get();
        if (!emailSnap.empty) {
          userDoc = emailSnap.docs[0];
        }
      }

      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
      const userPayload: Record<string, unknown> = {
        email: userEmail,
        password: hashedPassword,
        role: 'cliente',
        mustChangePassword: true,
        temporaryPasswordIssuedAt: new Date(),
        updatedAt: new Date(),
        active: true,
      };

      if (userDoc) {
        finalUserId = userDoc.id;
        if (!userDoc.data()?.email) {
          userPayload.email = userEmail;
        }
        await userCollection.doc(finalUserId).set(userPayload, { merge: true });
      } else {
        const newUserRef = userCollection.doc();
        finalUserId = newUserRef.id;
        await newUserRef.set({ uid: finalUserId, ...userPayload, createdAt: new Date() });
      }

      const emailContent = temporaryPasswordEmail({
        temporaryPassword,
        title: 'Tu licencia desktop ha sido creada',
        intro: 'Se ha generado una contraseña temporal para acceder desde el escritorio. Usa esta contraseña junto a tu correo y licencia.',
      });

      await sendAppMail({
        to: userEmail,
        subject: 'Contraseña temporal para licencia desktop',
        ...emailContent,
      });
    }

    const payload: Record<string, unknown> = {
      active: body.active !== false,
      plan: body.plan || 'desktop',
      userId: finalUserId,
      userEmail: finalUserEmail,
      expiresAt,
      allowedDevices: Array.isArray(body.allowedDevices) ? body.allowedDevices : [],
      updatedAt: new Date(),
      createdAt: existingLicenseSnap.exists ? existingLicenseSnap.data()?.createdAt || new Date() : new Date(),
    };

    await licenseRef.set(payload, { merge: true });
    return NextResponse.json({ success: true, passwordSent: shouldSendPassword, generatedPassword: shouldSendPassword ? temporaryPassword : null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error guardando licencia' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireSuperadmin(req);
    const body = await req.json();
    const licenseKey = String(body.licenseKey || '').trim();
    if (!licenseKey) {
      return NextResponse.json({ error: 'licenseKey es requerido' }, { status: 400 });
    }

    await adminDb.collection('desktopLicenses').doc(licenseKey).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error eliminando licencia' },
      { status: 500 }
    );
  }
}
