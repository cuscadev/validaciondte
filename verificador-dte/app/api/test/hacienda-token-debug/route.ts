import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getHaciendaTokenForUser } from '@/lib/hacienda-auth';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { environment = 'test' } = await req.json().catch(() => ({})) as { environment?: 'test' | 'production' };

    // Get Hacienda settings
    const userSnap = await adminDb.collection('users').doc(user.uid).get();
    const hacienda = userSnap.data()?.hacienda || {};

    // Get token
    const token = await getHaciendaTokenForUser(user.uid, true, environment);
    
    // Check token format
    const hasBearer = token.toLowerCase().startsWith('bearer ');
    const tokenPreview = token.substring(0, 50) + '...';

    return NextResponse.json({
      success: true,
      environment,
      token: {
        preview: tokenPreview,
        hasBearer,
        length: token.length,
      },
      hacienda: {
        nit: hacienda.nit || 'not-set',
        hasPassword: Boolean(hacienda.passwordEncrypted),
        lastAuthStatus: hacienda.lastAuthStatus || 'unknown',
        lastAuthError: hacienda.lastAuthError || 'none',
        lastAuthEnvironment: hacienda.lastAuthEnvironment || 'unknown',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 400 }
    );
  }
}
