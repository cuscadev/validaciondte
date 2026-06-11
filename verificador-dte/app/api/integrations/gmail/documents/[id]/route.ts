import { NextRequest, NextResponse } from 'next/server';

import { getDocumentById } from '@/lib/gmail/firebase-db';
import { buildHaciendaPublicUrl } from '@/lib/gmail/hacienda-url';
import { requireOrgMember } from '@/lib/server-auth';
import { getGmailPublicErrorMessage } from '@/lib/gmail/callback-errors';

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

    const jsonUrl = document.storage_path
      ? `/api/integrations/gmail/documents/${id}/raw`
      : null;

    const haciendaUrl =
      document.codigo_generacion && document.fec_emi
        ? buildHaciendaPublicUrl({
            ambiente: document.ambiente,
            codigoGeneracion: document.codigo_generacion,
            fecEmi: document.fec_emi,
          })
        : null;

    return NextResponse.json({ document, jsonUrl, haciendaUrl });
  } catch (error) {
    const message = getGmailPublicErrorMessage(error);
    console.error('[gmail/documents/id]', error);
    const status = message === 'No autorizado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
