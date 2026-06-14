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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function extractCodigosLote(data: Record<string, unknown>) {
  const explicit = stringArray(data.codigosLote);
  if (explicit.length) return explicit;

  const fromCodigoLote = String(data.codigoLote || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (fromCodigoLote.length) return fromCodigoLote;

  const chunks = Array.isArray(data.chunks) ? data.chunks.map(asRecord) : [];
  return chunks
    .map((chunk) => String(chunk.codigoLote || '').trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const limit = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get('limit') || 25)));
    const baseQuery = adminDb.collection('facturacionLotes');
    const snapshot = user.role === 'superadmin'
      ? await baseQuery.limit(limit).get()
      : await baseQuery.where('uid', '==', user.uid).limit(limit).get();

    const lotes = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const codigosLote = extractCodigosLote(data);
        return {
          id: doc.id,
          uid: data.uid || '',
          status: data.status || '',
          source: data.source || '',
          environment: data.environment || 'test',
          tipoDte: data.tipoDte || '',
          nit: data.nit || '',
          receptorId: data.receptorId || null,
          batchSize: data.batchSize || 0,
          chunkSize: data.chunkSize || 0,
          codigoLote: codigosLote.join(','),
          codigosLote,
          lastConsultaStatus: data.lastConsultaStatus || '',
          lastConsultaCodigoLote: data.lastConsultaCodigoLote || '',
          lastConsultaResponse: data.lastConsultaResponse || null,
          createdAt: dateToIso(data.createdAt),
          updatedAt: dateToIso(data.updatedAt),
          lastConsultedAt: dateToIso(data.lastConsultedAt),
        };
      })
      .filter((item) => item.codigosLote.length > 0)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, limit);

    return NextResponse.json({ lotes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron cargar lotes' },
      { status: 400 }
    );
  }
}
