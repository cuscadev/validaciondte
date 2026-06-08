import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-auth';
import { encryptSecret } from '@/lib/hacienda-crypto';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const snap = await adminDb.collection('users').doc(user.uid).get();
    const hacienda = snap.data()?.hacienda || {};
    const facturacion = snap.data()?.facturacion || {};

    return NextResponse.json({
      nit: hacienda.nit || '',
      environment: hacienda.environment || 'test',
      hasPassword: Boolean(hacienda.passwordEncrypted),
      hasCertificatePassword: Boolean(facturacion.certificatePasswordEncrypted),
      lastAuthStatus: hacienda.lastAuthStatus || '',
      lastAuthError: hacienda.lastAuthError || '',
      lastAuthEnvironment: hacienda.lastAuthEnvironment || '',
      tokenExpiresAt: hacienda.tokenExpiresAt?.toDate?.()?.toISOString?.() || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No autorizado' },
      { status: 401 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json() as {
      nit?: string;
      password?: string;
      certificatePassword?: string;
      environment?: string;
    };

    const nit = String(body.nit || '').replace(/\D/g, '');
    const password = String(body.password || '');
    const certificatePassword = String(body.certificatePassword || '');
    const environment = body.environment === 'production' ? 'production' : 'test';

    if (!nit) {
      return NextResponse.json({ error: 'Ingresa el NIT de Hacienda.' }, { status: 400 });
    }

    const hacienda: Record<string, unknown> = {
      nit,
      environment,
      updatedAt: new Date(),
    };

    if (password) {
      hacienda.passwordEncrypted = encryptSecret(password);
      hacienda.tokenEncrypted = '';
      hacienda.tokenExpiresAt = null;
      hacienda.lastAuthStatus = '';
      hacienda.lastAuthError = '';
    }

    const update: Record<string, unknown> = { hacienda };
    if (certificatePassword) {
      update.facturacion = {
        certificatePasswordEncrypted: encryptSecret(certificatePassword),
        certificatePasswordUpdatedAt: new Date(),
      };
    }

    await adminDb.collection('users').doc(user.uid).set(update, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo guardar Hacienda' },
      { status: 500 }
    );
  }
}
