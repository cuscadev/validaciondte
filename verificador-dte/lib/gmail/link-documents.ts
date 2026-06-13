import type { GmailDocumentLinkType } from '@/lib/gmail/types';

const INVOICE_TIPOS = new Set(['01', '03', '11', '14']);
const NC_TIPO = '05';
const ND_TIPO = '06';

export type LinkPairInput = {
  id: string;
  tipo_dte: string | null;
  codigo_generacion: string | null;
  related_codigos: string[];
};

export type LinkPair = {
  sourceDocumentId: string;
  targetDocumentId: string;
  linkType: GmailDocumentLinkType;
};

function linkTypeForSource(tipoDte: string | null): GmailDocumentLinkType {
  if (tipoDte === NC_TIPO) return 'nc_to_invoice';
  if (tipoDte === ND_TIPO) return 'nd_to_invoice';
  return 'json_reference';
}

/** Pure link planner used by rebuildDocumentLinks and unit tests. */
export function computeDocumentLinkPairs(documents: LinkPairInput[]): LinkPair[] {
  const byCodigo = new Map<string, LinkPairInput[]>();
  for (const doc of documents) {
    const codigo = doc.codigo_generacion?.toUpperCase();
    if (!codigo) continue;
    const list = byCodigo.get(codigo) || [];
    list.push(doc);
    byCodigo.set(codigo, list);
  }

  const seen = new Set<string>();
  const pairs: LinkPair[] = [];

  const pushPair = (pair: LinkPair) => {
    const key = `${pair.sourceDocumentId}:${pair.targetDocumentId}:${pair.linkType}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push(pair);
  };

  for (const doc of documents) {
    const relatedCodigos = doc.related_codigos || [];
    for (const codigoRaw of relatedCodigos) {
      const targets = byCodigo.get(codigoRaw.toUpperCase()) || [];
      for (const target of targets) {
        if (target.id === doc.id) continue;
        pushPair({
          sourceDocumentId: doc.id,
          targetDocumentId: target.id,
          linkType: linkTypeForSource(doc.tipo_dte),
        });
      }
    }

    if (doc.tipo_dte === NC_TIPO || doc.tipo_dte === ND_TIPO) {
      for (const codigoRaw of relatedCodigos) {
        const targets = byCodigo.get(codigoRaw.toUpperCase()) || [];
        for (const target of targets) {
          if (target.id === doc.id) continue;
          if (!INVOICE_TIPOS.has(target.tipo_dte || '')) continue;
          pushPair({
            sourceDocumentId: doc.id,
            targetDocumentId: target.id,
            linkType: linkTypeForSource(doc.tipo_dte),
          });
        }
      }
    }
  }

  for (const doc of documents) {
    if (!INVOICE_TIPOS.has(doc.tipo_dte || '')) continue;
    const codigo = doc.codigo_generacion?.toUpperCase();
    if (!codigo) continue;

    for (const other of documents) {
      if (other.id === doc.id) continue;
      if (other.tipo_dte !== NC_TIPO && other.tipo_dte !== ND_TIPO) continue;
      if (!(other.related_codigos || []).includes(codigo)) continue;
      pushPair({
        sourceDocumentId: other.id,
        targetDocumentId: doc.id,
        linkType: linkTypeForSource(other.tipo_dte),
      });
    }
  }

  return pairs;
}

export async function rebuildDocumentLinks(organizationId: string) {
  const { listImportedDocumentsForOrg, upsertDocumentLink } = await import(
    '@/lib/email-import/documents-api'
  );
  const documents = await listImportedDocumentsForOrg(organizationId);
  const pairs = computeDocumentLinkPairs(
    documents.map((doc) => ({
      id: doc.id,
      tipo_dte: doc.tipo_dte,
      codigo_generacion: doc.codigo_generacion,
      related_codigos: doc.related_codigos || [],
    }))
  );

  for (const pair of pairs) {
    await upsertDocumentLink({
      organizationId,
      sourceDocumentId: pair.sourceDocumentId,
      targetDocumentId: pair.targetDocumentId,
      linkType: pair.linkType,
    });
  }
}
