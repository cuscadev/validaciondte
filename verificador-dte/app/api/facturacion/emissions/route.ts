import { NextRequest, NextResponse } from 'next/server';

import { listEmisionData, type TipoDteEmision } from '@/lib/facturacion/emisiones-store';
import { requireAuth } from '@/lib/server-auth';

function dateToIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const tipoDte = req.nextUrl.searchParams.get('tipoDte') || '';
    const limit = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get('limit') || 50)));

    const rows = await listEmisionData({
      firebaseUid: user.uid,
      superadmin: user.role === 'superadmin',
      tipoDte: (tipoDte || undefined) as TipoDteEmision | undefined,
      limit,
    });

    const emissions = rows
      .map((data) => ({
        id: data.id as string,
        uid: data.uid || '',
        tipoDte: data.tipoDte || '',
        status: data.status || '',
        environment: data.environment || 'test',
        source: data.source || '',
        codigoGeneracion: data.codigoGeneracion || '',
        numeroControl: data.numeroControl || '',
        selloRecepcion: data.selloRecepcion || data.selloRecibido || '',
        totalPagar: data.totalPagar || 0,
        receptorId: data.receptorId || null,
        createdAt: dateToIso(data.createdAt),
        updatedAt: dateToIso(data.updatedAt),
      }))
      .filter((item) => !tipoDte || item.tipoDte === tipoDte);

    return NextResponse.json({ emissions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron cargar emisiones' },
      { status: 400 },
    );
  }
}
