import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-auth';

type FirestoreDateLike = {
  toDate?: () => Date;
};

function dateToIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as FirestoreDateLike).toDate === 'function') {
    return (value as FirestoreDateLike).toDate!().toISOString();
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const tipoDte = req.nextUrl.searchParams.get('tipoDte') || '';
    const limit = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get('limit') || 50)));
    const base = adminDb.collection('facturacionEmisiones');
    const snapshot = user.role === 'superadmin'
      ? await base.limit(limit).get()
      : await base.where('uid', '==', user.uid).limit(limit).get();

    const emissions = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: data.uid || '',
          tipoDte: data.tipoDte || '',
          status: data.status || '',
          environment: data.environment || 'test',
          source: data.source || '',
          codigoGeneracion: data.codigoGeneracion || '',
          numeroControl: data.numeroControl || '',
          selloRecepcion: data.selloRecepcion || '',
          totalPagar: data.totalPagar || 0,
          receptorId: data.receptorId || null,
          createdAt: dateToIso(data.createdAt),
          updatedAt: dateToIso(data.updatedAt),
        };
      })
      .filter((item) => !tipoDte || item.tipoDte === tipoDte)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, limit);

    return NextResponse.json({ emissions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron cargar emisiones' },
      { status: 400 }
    );
  }
}
