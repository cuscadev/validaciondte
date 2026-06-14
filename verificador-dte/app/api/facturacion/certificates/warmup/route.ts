export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getGoDteApiUrl } from '@/lib/go-dte-api';
import {
  goInternalHeaders,
  parseGoUpstreamError,
} from '@/lib/facturacion/go-facturacion-client';
import { getPostgresPool } from '@/lib/postgres';
import { requireAuth } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = (await req.json().catch(() => ({}))) as { firebaseUid?: string; emisorId?: number };

    const pool = getPostgresPool();
    const emitter = await pool.query<{ id: number; nit: string }>(
      `
        SELECT e.id, e.nit
        FROM usuarios u
        INNER JOIN usuario_emisor ue ON ue.usuario_id = u.id
        INNER JOIN emisores e ON e.id = ue.emisor_id
        WHERE u.firebase_uid = $1 AND e.activo = TRUE
        ORDER BY CASE ue.rol WHEN 'propietario' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END
        LIMIT 1
      `,
      [user.uid]
    );
    const row = emitter.rows[0];

    const res = await fetch(`${getGoDteApiUrl()}/api/facturacion/certificates/warmup`, {
      method: 'POST',
      headers: goInternalHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        firebaseUid: body.firebaseUid || user.uid,
        emisorId: body.emisorId || row?.id,
        nit: row?.nit,
      }),
      cache: 'no-store',
    });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = text;
    }
    if (!res.ok) {
      return NextResponse.json(
        {
          error: parseGoUpstreamError(data, 'Warmup fallo', res.status),
        },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
