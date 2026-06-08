export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-auth';
import { sendAppMail } from '@/lib/server-mail';
import {
  buildDteJsonBuffer,
  buildDtePdfBuffer,
  getDteCode,
  sanitizeDteFileName,
} from '@/lib/facturacion/dte-artifacts';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type Row = Record<string, unknown>;

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function escapeHtml(value: unknown) {
  return getString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(value: unknown) {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

function displayTipoDte(tipoDte: string) {
  return tipoDte === '03' ? 'Comprobante de credito fiscal' : 'Factura';
}

function buildDteEmailHtml(data: Row, id: string) {
  const finalPackage = asRecord(data.finalPackage || data);
  const dte = asRecord(finalPackage.dteJson || asRecord(data.documentResponse).dteJson || {});
  const identificacion = asRecord(dte.identificacion);
  const emisor = asRecord(dte.emisor);
  const receptor = asRecord(dte.receptor);
  const resumen = asRecord(dte.resumen);
  const codigo = getDteCode(data, id);
  const tipoDte = getString(data.tipoDte || identificacion.tipoDte);
  const tipo = displayTipoDte(tipoDte);
  const receptorNombre = getString(receptor.nombre) || 'Cliente';
  const receptorDocumento = getString(receptor.nit || receptor.numDocumento || receptor.nrc);
  const numeroControl = getString(data.numeroControl || identificacion.numeroControl);
  const fecha = [identificacion.fecEmi, identificacion.horEmi].map(getString).filter(Boolean).join(' ');
  const total = money(data.totalPagar || resumen.totalPagar);

  const rows = [
    ['Tipo', tipo],
    ['Numero de control', numeroControl || '-'],
    ['Codigo de generacion', codigo],
    ['NIT Emisor', emisor.nit || '-'],
    ['Fecha de emision', fecha || '-'],
    ['Total', total],
  ];

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Documento electronico</title>
  </head>
  <body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;color:#26313f;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f2f2;padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:900px;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:34px 36px 28px 36px;">
                <h1 style="margin:0 0 28px 0;text-align:center;color:#050505;font-size:29px;line-height:1.2;font-weight:500;">
                  Documento electronico
                </h1>

                <p style="margin:0 0 12px 0;font-size:16px;line-height:1.5;color:#4b5563;">
                  Estimado cliente: <span style="color:#334155;">${escapeHtml(receptorNombre)}</span>
                </p>
                <p style="margin:0 0 12px 0;font-size:16px;line-height:1.5;color:#4b5563;">
                  Documento de Identificacion: <span style="color:#334155;">${escapeHtml(receptorDocumento || '-')}</span>
                </p>
                <p style="margin:0 0 24px 0;font-size:16px;line-height:1.5;color:#4b5563;">
                  <strong style="color:#4b5563;">${escapeHtml(emisor.nombre || 'Emisor')}</strong> le emitio un documento electronico:
                </p>

                <div style="height:1px;background:#9ca3af;margin:0 0 24px 0;"></div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:12px;color:#334155;">
                  ${rows.map(([label, value], index) => `
                  <tr style="background:${index % 2 === 0 ? '#d8dee6' : '#ffffff'};">
                    <td style="width:52%;padding:14px 10px;">${escapeHtml(label)}:</td>
                    <td style="padding:14px 10px;font-weight:700;">${escapeHtml(value)}</td>
                  </tr>`).join('')}
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:34px;">
                  <tr>
                    <td align="center" style="padding:0 8px;">
                      <span style="display:inline-block;min-width:180px;border-radius:18px;background:#ef233c;color:#ffffff;padding:10px 18px;text-align:center;font-size:14px;font-weight:700;">
                        PDF adjunto
                      </span>
                    </td>
                    <td align="center" style="padding:0 8px;">
                      <span style="display:inline-block;min-width:180px;border-radius:18px;background:#666666;color:#ffffff;padding:10px 18px;text-align:center;font-size:14px;font-weight:700;">
                        JSON adjunto
                      </span>
                    </td>
                  </tr>
                </table>

                <p style="margin:28px 0 0 0;text-align:center;color:#64748b;font-size:12px;line-height:1.6;">
                  Este correo incluye siempre los archivos PDF y JSON del documento tributario electronico.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const to = String(body.to || '').trim().toLowerCase();

    if (!to || !isValidEmail(to)) {
      return NextResponse.json({ error: 'Ingresa un correo valido.' }, { status: 400 });
    }

    const snap = await adminDb.collection('facturacionEmisiones').doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Emision no encontrada' }, { status: 404 });
    }

    const data = snap.data() || {};
    if (user.role !== 'superadmin' && data.uid !== user.uid) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const codigo = getDteCode(data, id);
    const safeName = sanitizeDteFileName(codigo);
    const tipoDte = String(data.tipoDte || '');
    const documentName = displayTipoDte(tipoDte).toLowerCase();
    const pdfBuffer = buildDtePdfBuffer(data, id);
    const jsonBuffer = buildDteJsonBuffer(data);

    await sendAppMail({
      to,
      subject: `DTE ${codigo}`,
      text: [
        `Adjuntamos el ${documentName} electronico.`,
        `Codigo de generacion: ${codigo}`,
        '',
        'Se incluyen los archivos PDF y JSON del documento tributario electronico.',
      ].join('\n'),
      html: buildDteEmailHtml(data, id),
      attachments: [
        {
          filename: `${safeName}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
        {
          filename: `${safeName}.json`,
          content: jsonBuffer,
          contentType: 'application/json',
        },
      ],
    });

    await snap.ref.update({
      lastEmailTo: to,
      lastEmailSentAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, to });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo enviar el correo' },
      { status: 400 }
    );
  }
}
