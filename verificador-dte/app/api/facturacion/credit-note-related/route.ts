export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { listEmisionData } from '@/lib/facturacion/emisiones-store';
import { requireAuth } from '@/lib/server-auth';

type Row = Record<string, unknown>;

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function dateToIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (user.role !== 'cliente' && user.role !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const limit = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get('limit') || 50)));
    const rows = await listEmisionData({
      firebaseUid: user.uid,
      superadmin: user.role === 'superadmin',
      tipoDte: '03',
      limit,
    });

    const documents = rows
      .map((data) => {
        const finalPackage = asRecord(data.finalPackage || data);
        const dte = asRecord(finalPackage.dteJson || asRecord(data.documentResponse).dteJson);
        const identificacion = asRecord(dte.identificacion);
        const receptor = asRecord(dte.receptor);
        const resumen = asRecord(dte.resumen);
        const items = Array.isArray(dte.cuerpoDocumento) ? dte.cuerpoDocumento.map(asRecord) : [];
        return {
          id: data.id as string,
          tipoDte: getString(data.tipoDte || identificacion.tipoDte),
          status: getString(data.status),
          codigoGeneracion: getString(data.codigoGeneracion || identificacion.codigoGeneracion),
          numeroControl: getString(data.numeroControl || identificacion.numeroControl),
          selloRecepcion: getString(
            data.selloRecepcion ||
              data.selloRecibido ||
              finalPackage.selloRecepcion ||
              finalPackage.selloRecibido,
          ),
          fechaEmision: getString(identificacion.fecEmi),
          totalPagar: Number(data.totalPagar || resumen.totalPagar || 0),
          receptorId: data.receptorId || null,
          receptor,
          items,
          resumen,
          createdAt: dateToIso(data.createdAt),
        };
      })
      .filter((item) => item.tipoDte === '03' && item.codigoGeneracion && item.items.length > 0);

    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron cargar creditos fiscales' },
      { status: 400 },
    );
  }
}
