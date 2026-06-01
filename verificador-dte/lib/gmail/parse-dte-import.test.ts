import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ALLOWED_TIPO_DTE,
  extractRelatedDocuments,
  isAllowedTipoDte,
  parseDteFromObject,
  resolveDteItem,
} from './parse-dte-import';

const FACTURA_COD = 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890';
const NC_COD = 'B2C3D4E5-F6A7-8901-BCDE-F12345678901';

describe('parse-dte-import', () => {
  it('parses wrapped dte with allowed tipo 01', () => {
    const parsed = parseDteFromObject({
      dte: {
        identificacion: {
          codigoGeneracion: FACTURA_COD,
          fecEmi: '2024-06-15',
          tipoDte: '1',
          numeroControl: 'DTE-01-001-001',
          ambiente: '01',
        },
        emisor: { nit: '0614-010101-101-1', nrc: '12345', nombre: 'Emisor SA' },
        resumen: { totalPagar: 115.0, totalIva: 15.0 },
      },
    });

    assert.ok(parsed);
    assert.equal(parsed!.tipoDte, '01');
    assert.equal(parsed!.fecEmi, '2024-06-15');
    assert.equal(parsed!.emisorNit, '0614-010101-101-1');
    assert.equal(parsed!.montoTotal, 115);
  });

  it('rejects unsupported tipo via isAllowedTipoDte', () => {
    assert.equal(isAllowedTipoDte('07'), false);
    assert.equal(isAllowedTipoDte('05'), true);
    assert.equal(ALLOWED_TIPO_DTE.has('14'), true);
  });

  it('extracts documentoRelacionado from NC', () => {
    const dte = resolveDteItem({
      identificacion: { codigoGeneracion: NC_COD, fecEmi: '2024-06-20', tipoDte: '05' },
      documentoRelacionado: [
        {
          tipoDocumento: '03',
          numeroDocumento: FACTURA_COD,
          fechaEmision: '15/06/2024',
        },
      ],
    });
    const related = extractRelatedDocuments(dte);
    assert.equal(related.length, 1);
    assert.equal(related[0].codigoGeneracion, FACTURA_COD);
    assert.equal(related[0].tipoDocumento, '03');
    assert.equal(related[0].fechaEmi, '2024-06-15');
  });

  it('returns null for invalid JSON object', () => {
    assert.equal(parseDteFromObject({ foo: 'bar' }), null);
  });
});
