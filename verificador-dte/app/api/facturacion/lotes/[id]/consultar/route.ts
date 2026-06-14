import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getGoDteApiUrl } from '@/lib/go-dte-api';
import { getHaciendaTokenForUser } from '@/lib/hacienda-auth';
import { requireAuth } from '@/lib/server-auth';

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstCodigoLote(data: Record<string, unknown>) {
  const explicit = Array.isArray(data.codigosLote)
    ? data.codigosLote.map(getString).find(Boolean)
    : '';
  if (explicit) return explicit;

  const fromField = getString(data.codigoLote).split(',').map((item) => item.trim()).find(Boolean);
  if (fromField) return fromField;

  const chunks = Array.isArray(data.chunks) ? data.chunks.map(asRecord) : [];
  return chunks.map((chunk) => getString(chunk.codigoLote)).find(Boolean) || '';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as {
      codigoLote?: string;
      environment?: 'test' | 'production';
    };

    const ref = adminDb.collection('facturacionLotes').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
    }

    const data = snap.data() || {};
    if (user.role !== 'superadmin' && data.uid !== user.uid) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const environment = body.environment === 'production'
      ? 'production'
      : data.environment === 'production'
        ? 'production'
        : 'test';
    const codigoLote = getString(body.codigoLote) || firstCodigoLote(data);
    if (!codigoLote) {
      return NextResponse.json({ error: 'El lote no tiene codigoLote guardado' }, { status: 400 });
    }

    const token = await getHaciendaTokenForUser(user.uid, false, environment);
    const upstream = await fetch(
      `${getGoDteApiUrl()}/api/hacienda/consulta-dte-lote/${encodeURIComponent(codigoLote)}?environment=${environment}`,
      {
        headers: {
          Authorization: token,
        },
        cache: 'no-store',
      }
    );

    const text = await upstream.text();
    let payload: unknown = text;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    await ref.set({
      lastConsultedAt: new Date(),
      lastConsultaStatus: upstream.ok ? 'ok' : 'error',
      lastConsultaCodigoLote: codigoLote,
      lastConsultaResponse: payload,
      updatedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({
      success: upstream.ok,
      codigoLote,
      response: payload,
    }, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo consultar lote' },
      { status: 400 }
    );
  }
}
