export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getGoDteApiUrl } from '@/lib/go-dte-api';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/server-auth';
import { getHaciendaTokenForUser } from '@/lib/hacienda-auth';

type JsonRecord = Record<string, unknown>;

const DEFAULT_NIT = '22222222222229';

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function mergeDeep(base: JsonRecord, patch: JsonRecord): JsonRecord {
  const out: JsonRecord = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      out[key] = mergeDeep(base[key] as JsonRecord, value as JsonRecord);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function postGo(path: string, body: unknown, init?: RequestInit) {
  const upstream = await fetch(`${getGoDteApiUrl()}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const text = await upstream.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!upstream.ok) {
    throw new Error(
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error?: unknown }).error)
        : text || `Go API respondio HTTP ${upstream.status}`
    );
  }

  return payload;
}

function mockConsumerInvoice(nit: string, override?: JsonRecord) {
  const base: JsonRecord = {
    version: 3,
    ambiente: '00',
    correlativo: Date.now() % 999999999999999,
    establecimientoTipo: 'M',
    establecimiento: '001',
    puntoVenta: '001',
    emisor: {
      nit,
      nrc: '2463887',
      nombre: 'F & G CONSTRUCTORA DE EL SALVADOR, S.A. DE C.V.',
      codActividad: '42900',
      descActividad: 'Construccion de obras de ingenieria civil n.c.p.',
      nombreComercial: 'F & G CONSTRUCTORA DE EL SALVADOR, S.A. DE C.V.',
      tipoEstablecimiento: '01',
      direccion: {
        departamento: '05',
        municipio: '28',
        distrito: '28',
        complemento: 'Colonia La Sultana 2 Pasaje Poniente 3 Block P casa 4',
      },
      telefono: '22439538',
      correo: 'fygconstructorasadecv@gmail.com',
      codEstableMH: null,
      codEstable: null,
      codPuntoVentaMH: null,
      codPuntoVenta: null,
    },
    receptor: {
      tipoDocumento: '36',
      numDocumento: '12170903051017',
      nrc: '1639213',
      nombre: 'CONVASES, S.A. DE C.V.',
      codActividad: '42900',
      descActividad: 'Construccion de obras de ingenieria civil n.c.p.',
      nombreComercial: 'CONVASES, S.A. DE C.V.',
      direccion: {
        departamento: '05',
        municipio: '28',
        distrito: '28',
        complemento: 'CARRETERA AL CUCO KM 142.5, RESTAURANTE LA PEMA, SAN MIGUEL',
      },
      telefono: '75896520',
      correo: 'cvslplgdigital@gmail.com',
      codDomiciliado: 1,
      codPais: 'SV',
    },
    items: [
      {
        tipoItem: 2,
        codigo: 'SERV-TEST-001',
        descripcion: 'Servicio de prueba de facturacion electronica',
        cantidad: 1,
        uniMedida: 59,
        precioUni: 11.3,
      },
    ],
    pagos: [
      {
        codigo: '01',
        montoPago: 11.3,
      },
    ],
  };

  return mergeDeep(base, override || {});
}

function extractSello(response: unknown): string {
  const body = asRecord(response);
  return (
    getString(body.selloRecibido) ||
    getString(body.selloRecepcion) ||
    getString(asRecord(body.body).selloRecibido) ||
    getString(asRecord(body.body).selloRecepcion)
  );
}

export async function POST(req: NextRequest) {
  let runRef: FirebaseFirestore.DocumentReference | null = null;

  try {
    const user = await requireSuperadmin(req);
    const body = await req.json().catch(() => ({})) as {
      nit?: string;
      passwordPri?: string;
      environment?: 'test' | 'production';
      transmitir?: boolean;
      mock?: JsonRecord;
    };

    const environment = body.environment === 'production' ? 'production' : 'test';
    if (environment !== 'test') {
      return NextResponse.json(
        { error: 'Este flujo temporal solo permite ambiente test.' },
        { status: 400 }
      );
    }

    const nit = String(body.nit || DEFAULT_NIT).replace(/\D/g, '');
    const passwordPri = String(body.passwordPri || '');
    if (!passwordPri) {
      return NextResponse.json(
        { error: 'passwordPri es requerido para firmar el certificado de prueba.' },
        { status: 400 }
      );
    }

    runRef = adminDb.collection('facturacionEmisiones').doc();
    await runRef.set({
      uid: user.uid,
      environment,
      tipoDte: '01',
      nit,
      status: 'started',
      source: 'test-flow-factura',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const documentRequest = mockConsumerInvoice(nit, body.mock);
    const documentResponse = asRecord(await postGo(
      '/api/facturacion/documents/factura-consumidor-final',
      documentRequest
    ));

    const dteJson = documentResponse.dteJson;
    const codigoGeneracion = getString(documentResponse.codigoGeneracion);
    const numeroControl = getString(documentResponse.numeroControl);

    await runRef.set({
      status: 'document_created',
      documentRequest,
      documentResponse,
      codigoGeneracion,
      numeroControl,
      updatedAt: new Date(),
    }, { merge: true });

    const signResponse = asRecord(await postGo('/api/facturacion/sign', {
      nit,
      passwordPri,
      dteJson,
    }));
    const firma = getString(signResponse.firma);

    await runRef.set({
      status: 'signed',
      signResponse: {
        success: signResponse.success,
        firma,
      },
      updatedAt: new Date(),
    }, { merge: true });

    let haciendaResponse: unknown = null;
    let selloRecepcion = '';
    if (body.transmitir !== false) {
      const token = await getHaciendaTokenForUser(user.uid, false, environment);
      haciendaResponse = await postGo('/api/facturacion/transmissions/dte', {
        environment,
        ambiente: '00',
        idEnvio: Date.now(),
        version: Number(documentResponse.version || asRecord(asRecord(dteJson).identificacion).version || 2),
        tipoDte: '01',
        documento: firma,
      }, {
        headers: {
          Authorization: token,
        },
      });
      selloRecepcion = extractSello(haciendaResponse);
    }

    const finalPackage = {
      tipoDte: '01',
      codigoGeneracion,
      numeroControl,
      dteJson,
      firma,
      selloRecepcion,
      haciendaResponse,
      downloads: {
        json: `/api/facturacion/test-flow/factura/${runRef.id}/json`,
      },
    };

    await runRef.set({
      status: selloRecepcion ? 'received' : 'sent_without_seal',
      selloRecepcion,
      haciendaResponse,
      finalPackage,
      updatedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      id: runRef.id,
      status: selloRecepcion ? 'received' : 'sent_without_seal',
      codigoGeneracion,
      numeroControl,
      selloRecepcion,
      haciendaResponse,
      finalPackage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo ejecutar el flujo de prueba';
    if (runRef) {
      await runRef.set({
        status: 'error',
        error: message,
        updatedAt: new Date(),
      }, { merge: true }).catch(() => {});
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
