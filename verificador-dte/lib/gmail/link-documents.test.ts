import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeDocumentLinkPairs } from '@/lib/email/link-documents';

const FACTURA_COD = 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890';
const NC_COD = 'B2C3D4E5-F6A7-8901-BCDE-F12345678901';

describe('link-documents', () => {
  it('links NC to invoice by related codigo_generacion', () => {
    const pairs = computeDocumentLinkPairs([
      {
        id: 'inv-1',
        tipo_dte: '03',
        codigo_generacion: FACTURA_COD,
        related_codigos: [],
      },
      {
        id: 'nc-1',
        tipo_dte: '05',
        codigo_generacion: NC_COD,
        related_codigos: [FACTURA_COD],
      },
    ]);

    assert.ok(pairs.some((p) => p.sourceDocumentId === 'nc-1' && p.targetDocumentId === 'inv-1'));
    assert.equal(pairs.find((p) => p.sourceDocumentId === 'nc-1')?.linkType, 'nc_to_invoice');
  });

  it('links invoice inbound when NC references its codigo', () => {
    const pairs = computeDocumentLinkPairs([
      {
        id: 'inv-1',
        tipo_dte: '01',
        codigo_generacion: FACTURA_COD,
        related_codigos: [],
      },
      {
        id: 'nc-1',
        tipo_dte: '05',
        codigo_generacion: NC_COD,
        related_codigos: [FACTURA_COD],
      },
    ]);

    assert.ok(pairs.some((p) => p.sourceDocumentId === 'nc-1' && p.targetDocumentId === 'inv-1'));
  });
});
