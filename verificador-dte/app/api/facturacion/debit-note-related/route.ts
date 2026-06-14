export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-auth';

type Row = Record<string, unknown>;
type FirestoreDateLike = { toDate?: () => Date };

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

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
    if (user.role !== 'cliente' && user.role !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const limit = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get('limit') || 50)));
    const base = adminDb.collection('facturacionEmisiones');
    const snapshot = user.role === 'superadmin'
      ? await base.limit(limit).get()
      : await base.where('uid', '==', user.uid).limit(limit).get();

    const documents = snapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        const finalPackage = asRecord(data.finalPackage || data);
        const dte = asRecord(finalPackage.dteJson || asRecord(data.documentResponse).dteJson);
        const identificacion = asRecord(dte.identificacion);
        const receptor = asRecord(dte.receptor);
        const resumen = asRecord(dte.resumen);
        const items = Array.isArray(dte.cuerpoDocumento) ? dte.cuerpoDocumento.map(asRecord) : [];
        return {
          id: doc.id,
          tipoDte: getString(data.tipoDte || identificacion.tipoDte),
          status: getString(data.status),
          codigoGeneracion: getString(data.codigoGeneracion || identificacion.codigoGeneracion),
          numeroControl: getString(data.numeroControl || identificacion.numeroControl),
          selloRecepcion: getString(data.selloRecepcion || data.selloRecibido || finalPackage.selloRecepcion || finalPackage.selloRecibido),
          fechaEmision: getString(identificacion.fecEmi),
          totalPagar: Number(data.totalPagar || resumen.totalPagar || 0),
          receptorId: data.receptorId || null,
          receptor,
          items,
          resumen,
          createdAt: dateToIso(data.createdAt),
        };
      })
      .filter((item) => item.tipoDte === '03' && item.codigoGeneracion && item.items.length > 0)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, limit);

    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron cargar creditos fiscales' },
      { status: 400 }
    );
  }
}
