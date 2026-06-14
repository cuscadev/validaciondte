import {
  ambienteDteCode,
  buildDocumentSequenceFields,
  fetchEmisorEmissionContext,
  postGoFacturacion,
  resolveEmissionEnvironment,
  validateEmisorForEmission,
  type EmisorEmissionContext,
} from '@/lib/facturacion/go-facturacion-client';

export type PreparedEmission = EmisorEmissionContext & {
  environment: 'test' | 'production';
  ambiente: string;
  sequenceFields: Awaited<ReturnType<typeof buildDocumentSequenceFields>>;
};

export async function prepareEmission(
  firebaseUid: string,
  email: string,
  tipoDte: string,
  requestedEnvironment?: 'test' | 'production'
): Promise<PreparedEmission> {
  const context = await fetchEmisorEmissionContext(firebaseUid, email);
  validateEmisorForEmission(context.emisor);
  const environment = resolveEmissionEnvironment(requestedEnvironment, null);
  const sequenceFields = await buildDocumentSequenceFields(context, tipoDte);
  return {
    ...context,
    environment,
    ambiente: ambienteDteCode(environment),
    sequenceFields,
  };
}

export async function postGo(path: string, body: unknown, init?: RequestInit) {
  return postGoFacturacion(path, body, init);
}

export function buildBaseDocumentRequest(
  prepared: PreparedEmission,
  extra: Record<string, unknown> = {}
) {
  return {
    ambiente: prepared.ambiente,
    correlativo: prepared.sequenceFields.correlativo,
    numeroControl: prepared.sequenceFields.numeroControl,
    establecimientoTipo: prepared.sequenceFields.establecimientoTipo,
    establecimiento: prepared.sequenceFields.establecimiento,
    puntoVenta: prepared.sequenceFields.puntoVenta,
    emisor: prepared.emisor,
    ...extra,
  };
}
