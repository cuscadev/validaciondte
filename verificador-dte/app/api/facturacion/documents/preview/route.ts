export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import {
  buildConsumerInvoiceDocumentRequest,
  type ConsumerInvoiceItemInput,
} from '@/lib/facturacion/consumer-invoice-document';
import { postGo } from '@/lib/facturacion/prepare-emission';
import { preparePreviewEmission } from '@/lib/facturacion/prepare-emission';
import { getPostgresPool } from '@/lib/postgres';
import { requireAuth } from '@/lib/server-auth';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

async function getReceptor(emisorId: number, receptorId: number) {
  const result = await getPostgresPool().query(
    `
      SELECT
        c.*,
        a.nombre AS actividad_nombre
      FROM clientes c
      LEFT JOIN cat_024_codigo_actividad a ON a.codigo = c.codigo_actividad
      WHERE c.emisor_id = $1
        AND c.id = $2
        AND c.activo = TRUE
      LIMIT 1
    `,
    [emisorId, receptorId]
  );

  return result.rows[0] ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (user.role !== 'cliente' && user.role !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      tipoDte?: string;
      receptorId?: number;
      items?: ConsumerInvoiceItemInput[];
      observaciones?: string;
      environment?: 'test' | 'production';
    };

    const tipoDte = String(body.tipoDte || '01').trim();
    if (tipoDte !== '01') {
      return NextResponse.json({ error: 'Solo preview tipoDte 01 por ahora.' }, { status: 400 });
    }

    const prepared = await preparePreviewEmission(user.uid, user.email, tipoDte, body.environment);
    const receptorId = Number(body.receptorId || 0);
    if (!receptorId) {
      return NextResponse.json({ error: 'Selecciona un receptor.' }, { status: 400 });
    }

    const receptor = await getReceptor(prepared.emisorId, receptorId);
    if (!receptor) {
      return NextResponse.json({ error: 'Receptor no encontrado para este emisor.' }, { status: 404 });
    }

    const facturaConsumidorFinal = buildConsumerInvoiceDocumentRequest(
      prepared,
      receptor,
      body.items || [],
      body.observaciones
    );

    const previewResponse = asRecord(
      await postGo('/api/facturacion/documents/preview', {
        tipoDte: tipoDte,
        facturaConsumidorFinal,
      })
    );

    return NextResponse.json({
      success: true,
      preview: true,
      tipoDte: previewResponse.tipoDte || tipoDte,
      codigoGeneracion: previewResponse.codigoGeneracion,
      numeroControl: previewResponse.numeroControl,
      totalPagar: previewResponse.totalPagar,
      dteJson: previewResponse.dteJson,
      documentRequest: facturaConsumidorFinal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo generar vista previa del DTE';
    const status = message.includes('No autorizado') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
