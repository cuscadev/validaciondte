import { NextRequest, NextResponse } from 'next/server';

import { createSignedJsonUrl, getDocumentById } from '@/lib/email/db';
import { buildHaciendaPublicUrl } from '@/lib/gmail/hacienda-url';
import { requireOrgMember } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireOrgMember(req);
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Sin organizacion.' }, { status: 400 });
    }

    const { id } = await context.params;
    const document = await getDocumentById(id, user.organizationId);
    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
    }

    let jsonUrl: string | null = null;
    if (document.storage_path) {
      jsonUrl = await createSignedJsonUrl(document.storage_path);
    }

    const hasJsonContent = Boolean(document.json_content?.trim());

    const haciendaUrl =
      document.codigo_generacion && document.fec_emi
        ? buildHaciendaPublicUrl({
            ambiente: document.ambiente,
            codigoGeneracion: document.codigo_generacion,
            fecEmi: document.fec_emi,
          })
        : null;

    return NextResponse.json({
      document: hasJsonContent
        ? document
        : { ...document, json_content: null },
      jsonUrl,
      hasJsonContent,
      haciendaUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
