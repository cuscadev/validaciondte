import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { encryptSecret } from '@/lib/hacienda-crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      uid?: string;
      nit?: string;
      password?: string;
      environment?: string;
    };

    const uid = body.uid || 'NZc1SuBNDKSAOJfdnVbOnYLE6R02'; // test@empresa.sv
    const nit = body.nit || '06141812151015'; // Test NIT
    const password = body.password || 'Test123456'; // Test password
    const environment = body.environment || 'test';

    const userRef = adminDb.collection('users').doc(uid);
    
    await userRef.set({
      hacienda: {
        nit,
        passwordEncrypted: encryptSecret(password),
        environment,
        updatedAt: new Date(),
        lastAuthStatus: '',
        lastAuthError: '',
      },
    }, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'Credenciales de Hacienda configuradas para testing',
      uid,
      nit,
      environment,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error configurando Hacienda' },
      { status: 500 }
    );
  }
}
