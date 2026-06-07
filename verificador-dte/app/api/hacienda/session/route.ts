import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getHaciendaTokenForUser } from '@/lib/hacienda-auth';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as {
      forceRefresh?: boolean;
      environment?: 'test' | 'production';
    };
    const environment = body.environment === 'production' ? 'production' : 'test';
    const token = await getHaciendaTokenForUser(user.uid, Boolean(body.forceRefresh), environment);

    return NextResponse.json({
      success: true,
      environment,
      token,
      tokenType: token.startsWith('Bearer ') ? 'Bearer' : '',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo autenticar con Hacienda' },
      { status: 400 }
    );
  }
}
