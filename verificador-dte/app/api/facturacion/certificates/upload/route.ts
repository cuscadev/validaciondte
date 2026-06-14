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

type LinkedEmitter = {
  id: number;
  nit: string;
  rol_emisor: string;
};

async function getLinkedEmitter(uid: string, email: string): Promise<LinkedEmitter | null> {
  const pool = getPostgresPool();
  const result = await pool.query<LinkedEmitter>(
    `
      SELECT e.id, e.nit, ue.rol AS rol_emisor
      FROM usuarios u
      INNER JOIN usuario_emisor ue ON ue.usuario_id = u.id
      INNER JOIN emisores e ON e.id = ue.emisor_id
      WHERE u.activo = TRUE
        AND e.activo = TRUE
        AND (u.firebase_uid = $1 OR lower(u.email) = lower($2))
      ORDER BY CASE ue.rol WHEN 'propietario' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, e.id ASC
      LIMIT 1
    `,
    [uid, email]
  );
  return result.rows[0] ?? null;
}

function canUpdateCertificate(role: string) {
  return role === 'propietario' || role === 'editor';
}

async function updateAmbiente(emisorId: number, ambienteCodigo: string) {
  if (ambienteCodigo !== '00' && ambienteCodigo !== '01') return;
  const pool = getPostgresPool();
  await pool.query(
    `
      UPDATE emisores
      SET ambiente_codigo = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `,
    [ambienteCodigo, emisorId]
  );
}

async function warmupCertificate(uid: string, emisorId: number, nit: string) {
  await fetch(`${getGoDteApiUrl()}/api/facturacion/certificates/warmup`, {
    method: 'POST',
    headers: goInternalHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ firebaseUid: uid, emisorId, nit }),
    cache: 'no-store',
  }).catch(() => null);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const emitter = await getLinkedEmitter(user.uid, user.email || '');
    if (!emitter) {
      return NextResponse.json(
        { error: 'No hay emisor vinculado. Completa tu perfil de emisor primero.' },
        { status: 404 }
      );
    }
    if (!canUpdateCertificate(String(emitter.rol_emisor || ''))) {
      return NextResponse.json(
        { error: 'No tienes permiso para subir el certificado de este emisor.' },
        { status: 403 }
      );
    }

    const form = await req.formData();
    const file = form.get('file');
    const passwordPri = String(form.get('passwordPri') || '').trim();
    const ambienteCodigo = String(form.get('ambienteCodigo') || '').trim();

    if (ambienteCodigo) {
      await updateAmbiente(emitter.id, ambienteCodigo);
    }

    if (!(file instanceof File)) {
      if (ambienteCodigo) {
        return NextResponse.json({
          success: true,
          ambienteCodigo,
          message: 'Ambiente actualizado.',
        });
      }
      return NextResponse.json({ error: 'Selecciona un archivo .crt' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.crt')) {
      return NextResponse.json({ error: 'El certificado debe ser un archivo .crt' }, { status: 400 });
    }
    if (!passwordPri) {
      return NextResponse.json(
        { error: 'La contrasena del certificado es obligatoria.' },
        { status: 400 }
      );
    }

    if (!process.env.GO_DTE_INTERNAL_API_KEY?.trim()) {
      return NextResponse.json(
        {
          error:
            'GO_DTE_INTERNAL_API_KEY no esta configurada en verificador-dte. Debe coincidir con go-dte-api.',
        },
        { status: 500 }
      );
    }

    const goForm = new FormData();
    goForm.append('file', file, file.name);
    goForm.append('nit', emitter.nit);
    goForm.append('passwordPri', passwordPri);
    goForm.append('emisorId', String(emitter.id));

    const upstream = await fetch(`${getGoDteApiUrl()}/api/facturacion/certificates/upload`, {
      method: 'POST',
      headers: goInternalHeaders(),
      body: goForm,
      cache: 'no-store',
    });

    const upstreamText = await upstream.text();
    let data: unknown = {};
    try {
      data = upstreamText ? JSON.parse(upstreamText) : {};
    } catch {
      data = upstreamText;
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: parseGoUpstreamError(
            data,
            'No se pudo subir el certificado',
            upstream.status
          ),
        },
        { status: upstream.status }
      );
    }

    const payload = data as { path?: string };

    await warmupCertificate(user.uid, emitter.id, emitter.nit);

    return NextResponse.json({
      success: true,
      nit: emitter.nit,
      path: payload.path,
      ambienteCodigo: ambienteCodigo || undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
